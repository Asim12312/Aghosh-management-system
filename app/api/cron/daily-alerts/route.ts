import { timingSafeEqual } from "node:crypto";
import { query } from "@/lib/db";
import { getSetting } from "@/lib/dal/lookups";

/**
 * Daily summary of stock alerts and due demands, for a scheduler (cron, Task Scheduler, Vercel Cron)
 * to forward by email/WhatsApp later. The dashboard computes the same data live, so this is optional.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    Boolean(secret) && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  const reminder = await getSetting("demand_reminder_days", 3);
  const [stockAlerts, dueDemands] = await Promise.all([
    query("SELECT code, name_en, name_ur, current_stock, min_stock_level, days_of_cover, alert_level FROM v_stock_alerts ORDER BY days_of_cover NULLS FIRST"),
    query(
      `SELECT u.demand_no, u.required_by, u.days_left, i.name_en, i.name_ur, u.qty_pending, u.shortfall
         FROM v_upcoming_demands u JOIN items i ON i.id = u.item_id
        WHERE u.days_left <= $1 ORDER BY u.required_by`,
      [reminder],
    ),
  ]);
  return Response.json({ generatedAt: new Date().toISOString(), stockAlerts, dueDemands });
}
