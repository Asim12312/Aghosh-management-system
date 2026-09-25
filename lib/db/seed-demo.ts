// Demo data for testing: two logins plus a month of stock, demands, trips and fuel.
// Runs only when SEED_DEMO_DATA=true, and only on a database that has no users yet.
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "@/lib/auth/password";
import type { TxQueryable } from "./core";

export const DEMO_USERS = [
  { username: "admin", password: "Admin@12345", full_name: "Demo Admin", role: "admin" },
  { username: "staff", password: "Staff@12345", full_name: "Demo Staff", role: "staff" },
] as const;

export async function seedDemoData(q: TxQueryable) {
  const [{ n }] = await q.query<{ n: number }>("SELECT count(*)::int AS n FROM users");
  if (n > 0) return false;
  for (const u of DEMO_USERS) {
    await q.query(
      "INSERT INTO users (full_name, username, password_hash, role, preferred_locale) VALUES ($1, $2, $3, $4, 'en')",
      [u.full_name, u.username, await hashPassword(u.password), u.role],
    );
  }
  await q.exec(fs.readFileSync(path.join(process.cwd(), "db", "seed", "demo.sql"), "utf8"));
  console.log("[db] demo data loaded (admin / Admin@12345, staff / Staff@12345)");
  return true;
}
