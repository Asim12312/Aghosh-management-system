"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, query, tx } from "@/lib/db";
import { audit, requireAdmin, requireUser } from "@/lib/dal/auth";
import { lockAndGetStock, refreshDemandStatus } from "@/lib/dal/stock";
import { fmt, fmtNum } from "@/lib/i18n";
import { getRequestDictionary } from "@/lib/i18n/server";
import { fail, fieldsFor, parseForm, success, type ActionState } from "@/lib/validation";

class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

function revalidateInventory(locale: string) {
  revalidatePath(`/${locale}`, "layout");
}

// ───────────── Item master ─────────────
export async function saveItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      id: f.optId,
      name_en: f.str,
      name_ur: f.str,
      category_id: f.id,
      unit_id: f.id,
      default_vendor_id: f.optId,
      min_stock_level: f.optNum,
      reorder_qty: f.optNum,
      lead_time_days: f.optNum,
      is_perishable: f.bool,
      is_active: f.bool,
      notes: f.optStr,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  const isAdmin = user.role === "admin";

  // Items are picked by name everywhere, so names must be unique.
  const clash = await one<{ en: boolean }>(
    `SELECT lower(name_en) = lower($1) AS en FROM items
      WHERE (lower(name_en) = lower($1) OR name_ur = $2) AND id <> COALESCE($3, -1) LIMIT 1`,
    [v.name_en, v.name_ur, v.id],
  );
  if (clash) return fail(d.validation.fixErrors, clash.en ? { name_en: d.inventory.nameTaken } : { name_ur: d.inventory.nameTaken });

  if (v.id) {
    // Only admins may change stock thresholds or deactivate items.
    await one(
      `UPDATE items SET name_en=$1, name_ur=$2, category_id=$3, unit_id=$4, default_vendor_id=$5,
              reorder_qty=$6, is_perishable=$7, notes=$8, updated_at=now()
              ${isAdmin ? ", min_stock_level=$10, lead_time_days=$11, is_active=$12" : ""}
        WHERE id=$9`,
      [
        v.name_en,
        v.name_ur,
        v.category_id,
        v.unit_id,
        v.default_vendor_id,
        v.reorder_qty,
        v.is_perishable,
        v.notes,
        v.id,
        ...(isAdmin ? [v.min_stock_level ?? 0, Math.round(v.lead_time_days ?? 2), v.is_active] : []),
      ],
    );
    await audit(user.id, "update", "items", v.id, v);
  } else {
    const row = await one<{ id: number }>(
      `INSERT INTO items (name_en, name_ur, category_id, unit_id, default_vendor_id, min_stock_level, reorder_qty,
                          lead_time_days, is_perishable, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [
        v.name_en,
        v.name_ur,
        v.category_id,
        v.unit_id,
        v.default_vendor_id,
        v.min_stock_level ?? 0,
        v.reorder_qty,
        Math.round(v.lead_time_days ?? 2),
        v.is_perishable,
        v.notes,
      ],
    );
    await audit(user.id, "create", "items", row!.id, v);
  }
  revalidateInventory(locale);
  redirect(`/${locale}/inventory/items?saved=1`);
}

// ───────────── Inbound ─────────────
export async function recordStockIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      item_id: f.id,
      txn_date: f.date,
      quantity: f.posNum,
      fund_source_id: f.id,
      vendor_id: f.optId,
      donor_name: f.optStr,
      unit_cost: f.optNum,
      reference_no: f.optStr,
      expiry_date: f.optDate,
      remarks: f.optStr,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  const row = await one<{ id: number }>(
    `INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, fund_source_id, vendor_id, donor_name, unit_cost,
                                     reference_no, expiry_date, remarks, created_by)
     VALUES ('IN',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [v.item_id, v.txn_date, v.quantity, v.fund_source_id, v.vendor_id, v.donor_name, v.unit_cost, v.reference_no, v.expiry_date, v.remarks, user.id],
  );
  await audit(user.id, "stock_in", "stock_transactions", row!.id, v);
  revalidateInventory(locale);
  return success(d.common.saved);
}

// ───────────── Outbound ─────────────
async function issueStock(
  userId: number,
  d: Awaited<ReturnType<typeof getRequestDictionary>>["d"],
  v: {
    item_id: number | null;
    txn_date: string;
    quantity: number;
    department_id: number | null;
    demand_item_id: number | null;
    issued_to: string | null;
    remarks: string | null;
  },
) {
  return tx(async (q) => {
    let itemId = v.item_id;
    let departmentId = v.department_id;
    let demandSheetId: number | null = null;

    if (v.demand_item_id) {
      const [line] = await q.query<{ item_id: number; demand_sheet_id: number; status: string; department_id: number | null }>(
        `SELECT di.item_id, di.demand_sheet_id, ds.status, ds.department_id
           FROM demand_items di JOIN demand_sheets ds ON ds.id = di.demand_sheet_id WHERE di.id = $1`,
        [v.demand_item_id],
      );
      if (!line || !["approved", "partially_fulfilled"].includes(line.status))
        throw new UserError(d.validation.fixErrors, { demand_item_id: d.demands.notEditable });
      if (itemId && itemId !== line.item_id) throw new UserError(d.validation.fixErrors, { item_id: d.validation.invalid });
      itemId = line.item_id;
      departmentId = departmentId ?? line.department_id;
      demandSheetId = line.demand_sheet_id;
    }
    if (!itemId) throw new UserError(d.validation.fixErrors, { item_id: d.validation.required });
    if (!departmentId) throw new UserError(d.validation.fixErrors, { department_id: d.validation.required });

    const stock = await lockAndGetStock(q, itemId);
    if (stock === null) throw new UserError(d.validation.fixErrors, { item_id: d.validation.invalid });
    if (v.quantity > stock) throw new UserError(d.validation.fixErrors, { quantity: fmt(d.inventory.insufficient, { n: fmtNum(stock) }) });

    const [row] = await q.query<{ id: number }>(
      `INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, department_id, demand_item_id, issued_to, remarks, created_by)
       VALUES ('OUT',$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [itemId, v.txn_date, v.quantity, departmentId, v.demand_item_id, v.issued_to, v.remarks, userId],
    );
    if (demandSheetId) await refreshDemandStatus(q, demandSheetId);
    await audit(userId, "stock_out", "stock_transactions", row.id, { ...v, item_id: itemId, department_id: departmentId }, q);
    return row.id;
  });
}

export async function recordStockOut(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      item_id: f.optId,
      txn_date: f.date,
      quantity: f.posNum,
      department_id: f.optId,
      demand_item_id: f.optId,
      issued_to: f.optStr,
      remarks: f.optStr,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  try {
    await issueStock(user.id, d, parsed.data);
  } catch (err) {
    if (err instanceof UserError) return fail(err.message, err.fieldErrors);
    throw err;
  }
  revalidateInventory(locale);
  return success(d.common.saved);
}

// ───────────── Adjustment (admin) ─────────────
export async function recordAdjustment(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({ item_id: f.id, txn_date: f.date, quantity: f.num, remarks: f.str }).refine((v) => v.quantity !== 0, {
      path: ["quantity"],
      message: d.validation.invalid,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  try {
    await tx(async (q) => {
      const stock = await lockAndGetStock(q, v.item_id);
      if (stock === null) throw new UserError(d.validation.fixErrors, { item_id: d.validation.invalid });
      if (stock + v.quantity < 0)
        throw new UserError(d.validation.fixErrors, { quantity: fmt(d.inventory.insufficient, { n: fmtNum(stock) }) });
      const [row] = await q.query<{ id: number }>(
        `INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, remarks, created_by)
         VALUES ('ADJUST',$1,$2,$3,$4,$5) RETURNING id`,
        [v.item_id, v.txn_date, v.quantity, v.remarks, user.id],
      );
      await audit(user.id, "stock_adjust", "stock_transactions", row.id, v, q);
    });
  } catch (err) {
    if (err instanceof UserError) return fail(err.message, err.fieldErrors);
    throw err;
  }
  revalidateInventory(locale);
  return success(d.common.saved);
}

// ───────────── Void (admin) ─────────────
export async function voidTransaction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(z.object({ id: f.id, void_reason: f.str }), formData, d);
  if (!parsed.ok) return fail(parsed.state?.fieldErrors?.void_reason ?? d.validation.required);
  const { id, void_reason } = parsed.data;
  try {
    await tx(async (q) => {
      const [t] = await q.query<{ item_id: number; txn_type: string; quantity: number; voided_at: Date | null; demand_item_id: number | null }>(
        "SELECT item_id, txn_type, quantity, voided_at, demand_item_id FROM stock_transactions WHERE id = $1",
        [id],
      );
      if (!t) throw new UserError(d.common.unexpectedError);
      if (t.voided_at) throw new UserError(d.inventory.alreadyVoided);
      const stock = (await lockAndGetStock(q, t.item_id)) ?? 0;
      const effect = t.txn_type === "OUT" ? -t.quantity : t.quantity;
      if (stock - effect < 0) throw new UserError(d.inventory.voidWouldGoNegative);
      await q.query("UPDATE stock_transactions SET voided_at = now(), voided_by = $2, void_reason = $3 WHERE id = $1", [
        id,
        user.id,
        void_reason,
      ]);
      if (t.demand_item_id) {
        const [line] = await q.query<{ demand_sheet_id: number }>("SELECT demand_sheet_id FROM demand_items WHERE id = $1", [t.demand_item_id]);
        if (line) await refreshDemandStatus(q, line.demand_sheet_id);
      }
      await audit(user.id, "void", "stock_transactions", id, { void_reason }, q);
    });
  } catch (err) {
    if (err instanceof UserError) return fail(err.message);
    throw err;
  }
  revalidateInventory(locale);
  return success(d.common.saved);
}

// ───────────── Issue against a demand line (from the demand sheet screen) ─────────────
export async function issueAgainstDemand(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({ demand_item_id: f.id, quantity: f.posNum, txn_date: f.date, issued_to: f.optStr }),
    formData,
    d,
  );
  if (!parsed.ok) return fail(Object.values(parsed.state?.fieldErrors ?? {})[0] ?? d.validation.fixErrors);
  try {
    await issueStock(user.id, d, { ...parsed.data, item_id: null, department_id: null, remarks: null });
  } catch (err) {
    if (err instanceof UserError) return fail(Object.values(err.fieldErrors ?? {})[0] ?? err.message);
    throw err;
  }
  revalidateInventory(locale);
  return success(d.common.saved);
}

/** Issues every pending line of a demand (up to the stock available) and marks it fulfilled when complete. */
export async function issueAllForDemand(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const demandId = Number(formData.get("id"));
  const txnDate = String(formData.get("txn_date") || "") || new Date().toISOString().slice(0, 10);
  const lines = await query<{ demand_item_id: number; qty_pending: number; current_stock: number; name_en: string; name_ur: string }>(
    `SELECT u.demand_item_id, u.qty_pending, u.current_stock, i.name_en, i.name_ur
       FROM v_upcoming_demands u JOIN items i ON i.id = u.item_id
      WHERE u.demand_sheet_id = $1 AND u.status IN ('approved', 'partially_fulfilled')`,
    [demandId],
  );
  if (!lines.length) return fail(d.demands.notEditable);
  const short: string[] = [];
  for (const l of lines) {
    const qty = Math.min(l.qty_pending, l.current_stock);
    if (qty < l.qty_pending) short.push(locale === "ur" ? l.name_ur : l.name_en);
    if (qty <= 0) continue;
    try {
      await issueStock(user.id, d, {
        item_id: null,
        department_id: null,
        demand_item_id: l.demand_item_id,
        quantity: qty,
        txn_date: txnDate,
        issued_to: null,
        remarks: null,
      });
    } catch (err) {
      if (!(err instanceof UserError)) throw err;
      return fail(Object.values(err.fieldErrors ?? {})[0] ?? err.message);
    }
  }
  revalidateInventory(locale);
  return short.length ? fail(fmt(d.demands.issuedExceptShort, { items: short.join("، ") })) : success(d.demands.allIssued);
}
