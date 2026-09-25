import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { one, query } from "@/lib/db";

export const SESSION_COOKIE = "aghosh_session";
const SESSION_HOURS = 12;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  const h = await headers();
  await query("INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)", [
    hashToken(token),
    userId,
    expiresAt,
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    h.get("user-agent")?.slice(0, 300) ?? null,
  ]);
  // Opportunistic cleanup of expired sessions.
  await query("DELETE FROM sessions WHERE expires_at < now()");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE id = $1", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: number;
  full_name: string;
  username: string;
  role: "admin" | "staff";
  preferred_locale: "en" | "ur";
};

export async function readSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await one<SessionUser>(
    `SELECT u.id, u.full_name, u.username, u.role, u.preferred_locale
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.is_active`,
    [hashToken(token)],
  );
  return user ?? null;
}
