"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tx } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { audit, requireAdmin } from "@/lib/dal/auth";
import { getRequestDictionary } from "@/lib/i18n/server";
import { fail, fieldsFor, isUniqueViolation, parseForm, success, type ActionState } from "@/lib/validation";

export async function saveUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z.object({
      id: f.optId,
      full_name: f.str,
      username: f.str.refine((v) => /^[a-zA-Z0-9._-]{3,40}$/.test(v), d.validation.invalid),
      email: f.optStr,
      role: z.enum(["admin", "staff"], { error: d.validation.required }),
      preferred_locale: z.enum(["en", "ur"]).default("ur"),
      is_active: f.bool,
      password: f.optStr,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const v = parsed.data;
  if (!v.id && !v.password) return fail(d.validation.fixErrors, { password: d.validation.required });
  if (v.password && v.password.length < 8) return fail(d.validation.fixErrors, { password: d.auth.passwordTooShort });
  if (v.id === admin.id && (v.role !== "admin" || !v.is_active)) return fail(d.admin.cannotChangeSelf);

  const hash = v.password ? await hashPassword(v.password) : null;
  try {
    await tx(async (q) => {
      if (v.id) {
        await q.query(
          `UPDATE users SET full_name=$1, username=$2, email=$3, role=$4, preferred_locale=$5, is_active=$6,
                  password_hash = COALESCE($7, password_hash), updated_at = now()
            WHERE id = $8`,
          [v.full_name, v.username, v.email, v.role, v.preferred_locale, v.is_active, hash, v.id],
        );
        // Force re-login after a password reset or deactivation (role is read fresh on every request).
        if (hash || !v.is_active) await q.query("DELETE FROM sessions WHERE user_id = $1", [v.id]);
        await audit(admin.id, "update", "users", v.id, { ...v, password: hash ? "(changed)" : undefined }, q);
      } else {
        const [row] = await q.query<{ id: number }>(
          `INSERT INTO users (full_name, username, email, role, preferred_locale, is_active, password_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [v.full_name, v.username, v.email, v.role, v.preferred_locale, v.is_active, hash],
        );
        await audit(admin.id, "create", "users", row.id, { ...v, password: undefined }, q);
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) return fail(d.validation.fixErrors, { username: d.admin.usernameTaken });
    throw err;
  }
  revalidatePath(`/${locale}/admin/users`);
  redirect(`/${locale}/admin/users?saved=1`);
}

export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const days = z.preprocess(
    (x) => (typeof x === "string" && x.trim() !== "" ? Number(x) : undefined),
    z.number({ error: d.validation.number }).int(d.validation.number).min(1, d.validation.positive).max(365, d.validation.invalid),
  );
  const parsed = parseForm(
    z.object({
      stock_alert_horizon_days: days,
      consumption_window_days: days,
      demand_reminder_days: days,
      org_name_en: f.str,
      org_name_ur: f.str,
    }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  await tx(async (q) => {
    for (const [key, value] of Object.entries(parsed.data)) {
      await q.query(
        `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, JSON.stringify(value), admin.id],
      );
    }
    await audit(admin.id, "update", "app_settings", null, parsed.data, q);
  });
  revalidatePath(`/${locale}`, "layout");
  return success(d.common.saved);
}
