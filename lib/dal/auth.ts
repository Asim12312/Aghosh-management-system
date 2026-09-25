import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSessionUser, type SessionUser } from "@/lib/auth/session";
import { getRequestLocale } from "@/lib/i18n/server";
import { query, type Queryable } from "@/lib/db";

export type { SessionUser };

export const getCurrentUser = cache(readSessionUser);

/** Every page and Server Action calls one of these; the proxy check is only an optimistic redirect. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${await getRequestLocale()}/login`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect(`/${await getRequestLocale()}/dashboard?denied=1`);
  return user;
}

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId: string | number | null,
  details?: Record<string, unknown>,
  q: Queryable = { query },
) {
  await q.query("INSERT INTO audit_logs (user_id, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5)", [
    userId,
    action,
    entity,
    entityId === null ? null : String(entityId),
    details ? JSON.stringify(details) : null,
  ]);
}
