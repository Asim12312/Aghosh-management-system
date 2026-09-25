"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, tx } from "@/lib/db";
import { audit, requireUser } from "@/lib/dal/auth";
import { refreshDemandStatus } from "@/lib/dal/stock";
import { getRequestDictionary } from "@/lib/i18n/server";
import { fail, fieldsFor, isUniqueViolation, parseForm, type ActionState } from "@/lib/validation";

const lineSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  qty_boys: z.coerce.number().min(0).default(0),
  qty_girls: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export async function saveDemand(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      id: f.optId,
      created_on: f.date,
      required_by: f.date,
      department_id: f.optId,
      purpose: f.optStr,
      lines: z.string().default("[]"),
      intent: z.enum(["draft", "submit"]).default("draft"),
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  if (v.required_by < v.created_on) return fail(d.validation.fixErrors, { required_by: d.demands.requiredAfterCreated });

  let lines: z.infer<typeof lineSchema>[];
  try {
    lines = z.array(lineSchema).parse(JSON.parse(v.lines)).filter((l) => l.qty_boys + l.qty_girls > 0);
  } catch {
    return fail(d.demands.atLeastOneLine);
  }
  if (lines.length === 0) return fail(d.demands.atLeastOneLine);
  if (new Set(lines.map((l) => l.item_id)).size !== lines.length) return fail(d.demands.duplicateItem);

  const status = v.intent === "submit" ? "submitted" : "draft";
  let id: number;
  try {
    id = await tx(async (q) => {
      let demandId = v.id;
      if (demandId) {
        const [existing] = await q.query<{ status: string; requested_by: number }>(
          "SELECT status, requested_by FROM demand_sheets WHERE id = $1 FOR UPDATE",
          [demandId],
        );
        const canEdit =
          existing &&
          (existing.status === "draft" || existing.status === "submitted") &&
          (user.role === "admin" || existing.requested_by === user.id);
        if (!canEdit) throw new Error("NOT_EDITABLE");
        await q.query(
          `UPDATE demand_sheets SET created_on=$1, required_by=$2, department_id=$3, purpose=$4, status=$5, updated_at=now() WHERE id=$6`,
          [v.created_on, v.required_by, v.department_id, v.purpose, status, demandId],
        );
        await q.query("DELETE FROM demand_items WHERE demand_sheet_id = $1", [demandId]);
      } else {
        const year = v.created_on.slice(0, 4);
        const [seq] = await q.query<{ n: number }>(
          "SELECT COALESCE(MAX(split_part(demand_no, '-', 3)::int), 0) + 1 AS n FROM demand_sheets WHERE demand_no LIKE $1",
          [`DS-${year}-%`],
        );
        const demandNo = `DS-${year}-${String(seq.n).padStart(4, "0")}`;
        const [row] = await q.query<{ id: number }>(
          `INSERT INTO demand_sheets (demand_no, created_on, required_by, department_id, purpose, status, requested_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [demandNo, v.created_on, v.required_by, v.department_id, v.purpose, status, user.id],
        );
        demandId = row.id;
      }
      for (const l of lines) {
        await q.query(
          "INSERT INTO demand_items (demand_sheet_id, item_id, qty_boys, qty_girls, remarks) VALUES ($1,$2,$3,$4,$5)",
          [demandId, l.item_id, l.qty_boys, l.qty_girls, l.remarks || null],
        );
      }
      await audit(user.id, v.id ? "update" : "create", "demand_sheets", demandId, { status, lines: lines.length }, q);
      return demandId;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_EDITABLE") return fail(d.demands.notEditable);
    if (isUniqueViolation(err)) return fail(d.common.unexpectedError);
    throw err;
  }
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/demands/${id}`);
}

export async function changeDemandStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const id = Number(formData.get("id"));
  const op = String(formData.get("op"));
  const demand = await one<{ status: string; requested_by: number }>("SELECT status, requested_by FROM demand_sheets WHERE id = $1", [id]);
  if (!demand) return fail(d.common.unexpectedError);
  const isAdmin = user.role === "admin";
  const isOwner = demand.requested_by === user.id;

  let next: string | null = null;
  if (op === "submit" && demand.status === "draft" && (isAdmin || isOwner)) next = "submitted";
  else if (op === "approve" && demand.status === "submitted" && isAdmin) next = "approved";
  else if (op === "cancel" && !["fulfilled", "cancelled"].includes(demand.status) && (isAdmin || (isOwner && demand.status === "draft")))
    next = "cancelled";
  if (!next) return fail(d.demands.notEditable);

  await tx(async (q) => {
    await q.query(
      `UPDATE demand_sheets SET status = $2::demand_status, updated_at = now(),
              approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
              approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END
        WHERE id = $1`,
      [id, next, user.id],
    );
    // An approved demand whose items were already issued goes straight to its real status.
    if (next === "approved") await refreshDemandStatus(q, id);
    await audit(user.id, op, "demand_sheets", id, { from: demand.status, to: next }, q);
  });
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/demands/${id}`);
}
