import "server-only";
import { query } from "@/lib/db";

export type TxnRow = {
  id: number;
  txn_type: "IN" | "OUT" | "ADJUST";
  txn_date: string;
  quantity: number;
  item_id: number;
  item_code: string;
  item_en: string;
  item_ur: string;
  unit_en: string;
  unit_ur: string;
  source_en: string | null;
  source_ur: string | null;
  vendor: string | null;
  donor_name: string | null;
  unit_cost: number | null;
  reference_no: string | null;
  dept_en: string | null;
  dept_ur: string | null;
  demand_no: string | null;
  issued_to: string | null;
  remarks: string | null;
  created_by_name: string;
  created_at: Date;
  voided_at: Date | null;
  void_reason: string | null;
};

export type TxnFilters = {
  type?: string;
  itemId?: number;
  from?: string;
  to?: string;
  includeVoided?: boolean;
  limit?: number;
};

export async function getTransactions(filters: TxnFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };
  if (filters.type && ["IN", "OUT", "ADJUST"].includes(filters.type)) add("t.txn_type = ?", filters.type);
  if (filters.itemId) add("t.item_id = ?", filters.itemId);
  if (filters.from) add("t.txn_date >= ?", filters.from);
  if (filters.to) add("t.txn_date <= ?", filters.to);
  if (!filters.includeVoided) where.push("t.voided_at IS NULL");
  params.push(filters.limit ?? 500);
  return query<TxnRow>(
    `SELECT t.id, t.txn_type, t.txn_date, t.quantity, t.item_id, i.code AS item_code, i.name_en AS item_en, i.name_ur AS item_ur,
            u.name_en AS unit_en, u.name_ur AS unit_ur, fs.name_en AS source_en, fs.name_ur AS source_ur, v.name AS vendor,
            t.donor_name, t.unit_cost, t.reference_no, dp.name_en AS dept_en, dp.name_ur AS dept_ur, ds.demand_no,
            t.issued_to, t.remarks, cu.full_name AS created_by_name, t.created_at, t.voided_at, t.void_reason
       FROM stock_transactions t
       JOIN items i ON i.id = t.item_id
       JOIN units u ON u.id = i.unit_id
       JOIN users cu ON cu.id = t.created_by
       LEFT JOIN fund_sources fs ON fs.id = t.fund_source_id
       LEFT JOIN vendors v ON v.id = t.vendor_id
       LEFT JOIN departments dp ON dp.id = t.department_id
       LEFT JOIN demand_items di ON di.id = t.demand_item_id
       LEFT JOIN demand_sheets ds ON ds.id = di.demand_sheet_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY t.txn_date DESC, t.id DESC
      LIMIT $${params.length}`,
    params,
  );
}

/** Open demand lines (approved or partially fulfilled) that still need stock. */
export async function getOpenDemandLines() {
  return query<{
    demand_item_id: number;
    demand_no: string;
    required_by: string;
    item_id: number;
    name_en: string;
    name_ur: string;
    qty_pending: number;
  }>(
    `SELECT u.demand_item_id, u.demand_no, u.required_by, u.item_id, i.name_en, i.name_ur, u.qty_pending
       FROM v_upcoming_demands u JOIN items i ON i.id = u.item_id
      WHERE u.status IN ('approved', 'partially_fulfilled')
      ORDER BY u.required_by, u.demand_no`,
  );
}
