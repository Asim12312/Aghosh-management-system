"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { one, query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { audit } from "@/lib/dal/auth";
import { getRequestDictionary } from "@/lib/i18n/server";
import { fail, fieldsFor, parseForm, type ActionState } from "@/lib/validation";

// Simple in-memory brute-force protection: 5 failures per username per 10 minutes.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 10 * 60 * 1000;

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(z.object({ username: f.str, password: f.str }), formData, d);
  if (!parsed.ok) return parsed.state;
  const { username, password } = parsed.data;
  const key = username.toLowerCase();

  const entry = failures.get(key);
  if (entry && entry.count >= 5 && entry.until > Date.now()) return fail(d.auth.tooMany);

  const user = await one<{ id: number; password_hash: string; is_active: boolean }>(
    "SELECT id, password_hash, is_active FROM users WHERE lower(username) = lower($1)",
    [username],
  );
  const valid = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !valid || !user.is_active) {
    const next = entry && entry.until > Date.now() ? entry.count + 1 : 1;
    failures.set(key, { count: next, until: Date.now() + WINDOW_MS });
    return fail(d.auth.invalid);
  }
  failures.delete(key);
  await createSession(user.id);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
  await audit(user.id, "login", "user", user.id);
  redirect(`/${locale}/dashboard`);
}

/** Creates the first administrator. Only works while the users table is empty. */
export async function setupAdmin(_: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, d } = await getRequestDictionary();
  const f = fieldsFor(d);
  const parsed = parseForm(
    z
      .object({ full_name: f.str, username: f.str, password: f.str, confirm: f.str })
      .refine((v) => v.password.length >= 8, { path: ["password"], message: d.auth.passwordTooShort })
      .refine((v) => v.password === v.confirm, { path: ["confirm"], message: d.auth.passwordMismatch }),
    formData,
    d,
  );
  if (!parsed.ok) return parsed.state;
  const count = await one<{ n: number }>("SELECT count(*)::int AS n FROM users");
  if ((count?.n ?? 0) > 0) redirect(`/${locale}/login`);

  const { full_name, username, password } = parsed.data;
  const created = await one<{ id: number }>(
    "INSERT INTO users (full_name, username, password_hash, role, preferred_locale) VALUES ($1, $2, $3, 'admin', $4) RETURNING id",
    [full_name, username, await hashPassword(password), locale],
  );
  await createSession(created!.id);
  await audit(created!.id, "create", "user", created!.id, { username, role: "admin", setup: true });
  redirect(`/${locale}/dashboard`);
}

export async function logout() {
  const { locale } = await getRequestDictionary();
  await deleteSession();
  redirect(`/${locale}/login`);
}
