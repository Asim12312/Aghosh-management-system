"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one } from "@/lib/db";
import { audit, requireAdmin } from "@/lib/dal/auth";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getMasterEntity } from "@/lib/master";
import { fail, fieldsFor, isUniqueViolation, parseForm, type ActionState } from "@/lib/validation";

export async function saveMasterRecord(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const entity = getMasterEntity(String(formData.get("_entity")));
  if (!entity) return fail(d.common.unexpectedError);
  const idRaw = formData.get("_id");
  const id = idRaw ? Number(idRaw) : null;

  const f = fieldsFor(d);
  const shape: Record<string, z.ZodType> = {};
  for (const field of entity.fields) {
    if (field.type === "number") shape[field.name] = field.required ? f.nonNegNum : f.optNum;
    else if (field.type === "date") shape[field.name] = field.required ? f.date : f.optDate;
    else if (field.type === "bool") shape[field.name] = f.bool;
    else if (field.type === "select") {
      const allowed = (v: string | null) => v === null || field.options!.some((o) => o.value === v);
      shape[field.name] = field.required ? f.str.refine(allowed, d.validation.invalid) : f.optStr.refine(allowed, d.validation.invalid);
    }
    else shape[field.name] = field.required ? f.str : f.optStr;
  }
  if (entity.hasActive) shape.is_active = f.bool;

  const parsed = parseForm(z.object(shape), formData, d);
  if (!parsed.ok) return parsed.state;
  const values = parsed.data as Record<string, unknown>;
  const cols = Object.keys(values);

  try {
    if (id) {
      const set = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
      const row = await one(`UPDATE ${entity.table} SET ${set} WHERE id = $${cols.length + 1} RETURNING id`, [
        ...cols.map((c) => values[c]),
        id,
      ]);
      if (!row) return fail(d.common.unexpectedError);
      await audit(user.id, "update", entity.table, id, values);
    } else {
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
      const row = await one<{ id: number }>(
        `INSERT INTO ${entity.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING id`,
        cols.map((c) => values[c]),
      );
      await audit(user.id, "create", entity.table, row!.id, values);
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      const firstUnique = entity.fields[0].name;
      return fail(d.validation.fixErrors, { [firstUnique]: d.validation.duplicate });
    }
    throw err;
  }
  revalidatePath(`/${locale}/master/${entity.key}`);
  redirect(`/${locale}/master/${entity.key}?saved=1`);
}
