"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { one, tx } from "@/lib/db";
import { audit, requireAdmin, requireUser } from "@/lib/dal/auth";
import { getRequestDictionary } from "@/lib/i18n/server";
import { getMasterEntity } from "@/lib/master";
import { fail, isForeignKeyViolation, type ActionState } from "@/lib/validation";

/**
 * Hard deletes are allowed only for records nothing else points to. Anything already used
 * (an item with stock entries, a vehicle with trips…) is refused by the database's foreign keys,
 * and the user is told to mark it inactive instead, so history and reports stay intact.
 */
async function deleteRow(table: string, id: number, userId: number, inUse: string) {
  try {
    const row = await one<Record<string, unknown>>(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    if (row) await audit(userId, "delete", table, id, row);
    return null;
  } catch (err) {
    if (isForeignKeyViolation(err)) return fail(inUse);
    throw err;
  }
}

const idOf = (formData: FormData) => Number(formData.get("id"));

export async function deleteMasterRecord(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const entity = getMasterEntity(String(formData.get("_entity")));
  if (!entity) return fail(d.common.unexpectedError);
  const error = await deleteRow(entity.table, idOf(formData), user.id, d.common.inUse);
  if (error) return error;
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/master/${entity.key}?deleted=1`);
}

export async function deleteItem(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const error = await deleteRow("items", idOf(formData), user.id, d.common.inUse);
  if (error) return error;
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/inventory/items?deleted=1`);
}

export async function deleteUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const id = idOf(formData);
  if (id === admin.id) return fail(d.admin.cannotChangeSelf);
  // Sessions and audit entries don't count as "use": clear them so an unused account can be removed.
  let error: ActionState;
  try {
    await tx(async (q) => {
      await q.query("DELETE FROM sessions WHERE user_id = $1", [id]);
      await q.query("UPDATE audit_logs SET user_id = NULL WHERE user_id = $1", [id]);
      await q.query("UPDATE app_settings SET updated_by = NULL WHERE updated_by = $1", [id]);
      const [row] = await q.query<Record<string, unknown>>("DELETE FROM users WHERE id = $1 RETURNING id, username, full_name, role", [id]);
      if (row) await audit(admin.id, "delete", "users", id, row, q);
    });
  } catch (err) {
    if (!isForeignKeyViolation(err)) throw err;
    error = fail(d.admin.userInUse);
  }
  if (error) return error;
  revalidatePath(`/${locale}/admin/users`);
  redirect(`/${locale}/admin/users?deleted=1`);
}

export async function deleteDemand(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { locale, d } = await getRequestDictionary();
  const id = idOf(formData);
  const demand = await one<{ status: string; requested_by: number }>("SELECT status, requested_by FROM demand_sheets WHERE id = $1", [id]);
  if (!demand) return fail(d.common.unexpectedError);
  const allowed =
    (user.role === "admin" && ["draft", "cancelled"].includes(demand.status)) ||
    (demand.requested_by === user.id && demand.status === "draft");
  if (!allowed) return fail(d.demands.notDeletable);
  const error = await deleteRow("demand_sheets", id, user.id, d.demands.notDeletable);
  if (error) return error;
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/demands?deleted=1`);
}

export async function deleteTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const error = await deleteRow("vehicle_trips", idOf(formData), user.id, d.common.inUse);
  if (error) return error;
  revalidatePath(`/${locale}`, "layout");
  redirect(`/${locale}/fleet/trips?deleted=1`);
}
