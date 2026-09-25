import "server-only";
import type { Queryable } from "@/lib/db";

/** Locks the item row so concurrent issues cannot both pass the stock check, then returns the balance. */
export async function lockAndGetStock(q: Queryable, itemId: number): Promise<number | null> {
  const item = await q.query<{ id: number }>("SELECT id FROM items WHERE id = $1 FOR UPDATE", [itemId]);
  if (!item.length) return null;
  const [row] = await q.query<{ current_stock: number }>("SELECT current_stock FROM v_item_stock WHERE item_id = $1", [itemId]);
  return row?.current_stock ?? 0;
}

/** Recomputes a demand sheet's status from how much has been issued against its lines. */
export async function refreshDemandStatus(q: Queryable, demandSheetId: number) {
  await q.query(
    `UPDATE demand_sheets ds
        SET status = CASE
              WHEN p.total_pending <= 0 THEN 'fulfilled'::demand_status
              WHEN p.total_issued  >  0 THEN 'partially_fulfilled'::demand_status
              ELSE 'approved'::demand_status END,
            updated_at = now()
       FROM (SELECT SUM(GREATEST(qty_total - qty_issued, 0)) AS total_pending, SUM(qty_issued) AS total_issued
               FROM v_demand_item_progress WHERE demand_sheet_id = $1) p
      WHERE ds.id = $1 AND ds.status IN ('approved', 'partially_fulfilled', 'fulfilled')`,
    [demandSheetId],
  );
}
