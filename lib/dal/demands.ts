import "server-only";
import { one, query } from "@/lib/db";

export type DemandStatus = "draft" | "submitted" | "approved" | "partially_fulfilled" | "fulfilled" | "cancelled";

export type DemandHeader = {
  id: number;
  demand_no: string;
  created_on: string;
  required_by: string;
  department_id: number | null;
  dept_en: string | null;
  dept_ur: string | null;
  status: DemandStatus;
  purpose: string | null;
  requested_by: number;
  requested_by_name: string;
  approved_by_name: string | null;
  approved_at: Date | null;
  days_left: number;
};

export type DemandLine = {
  id: number;
  item_id: number;
  code: string;
  name_en: string;
  name_ur: string;
  unit_en: string;
  unit_ur: string;
  qty_boys: number;
  qty_girls: number;
  qty_total: number;
  qty_issued: number;
  current_stock: number;
  remarks: string | null;
};

export async function getDemand(id: number) {
  const header = await one<DemandHeader>(
    `SELECT ds.id, ds.demand_no, ds.created_on, ds.required_by, ds.department_id, dp.name_en AS dept_en, dp.name_ur AS dept_ur,
            ds.status, ds.purpose, ds.requested_by, ru.full_name AS requested_by_name, au.full_name AS approved_by_name, ds.approved_at,
            (ds.required_by - current_date) AS days_left
       FROM demand_sheets ds
       JOIN users ru ON ru.id = ds.requested_by
       LEFT JOIN users au ON au.id = ds.approved_by
       LEFT JOIN departments dp ON dp.id = ds.department_id
      WHERE ds.id = $1`,
    [id],
  );
  if (!header) return null;
  const lines = await query<DemandLine>(
    `SELECT p.id, p.item_id, i.code, i.name_en, i.name_ur, u.name_en AS unit_en, u.name_ur AS unit_ur,
            p.qty_boys, p.qty_girls, p.qty_total, p.qty_issued, s.current_stock, p.remarks
       FROM v_demand_item_progress p
       JOIN items i ON i.id = p.item_id
       JOIN units u ON u.id = i.unit_id
       JOIN v_item_stock s ON s.item_id = p.item_id
      WHERE p.demand_sheet_id = $1
      ORDER BY p.id`,
    [id],
  );
  return { header, lines };
}

export const statusTone: Record<DemandStatus, "gray" | "blue" | "violet" | "amber" | "green" | "red"> = {
  draft: "gray",
  submitted: "blue",
  approved: "violet",
  partially_fulfilled: "amber",
  fulfilled: "green",
  cancelled: "red",
};
