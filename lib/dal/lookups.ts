import "server-only";
import { query } from "@/lib/db";
import { fmtNum, nm, type Locale } from "@/lib/i18n";

export type Named = { id: number; name_en: string; name_ur: string };
export type ItemOption = Named & { code: string; unit_en: string; unit_ur: string; current_stock: number; category_id: number };

export const getDepartments = (activeOnly = true) =>
  query<Named & { code: string }>(`SELECT id, code, name_en, name_ur FROM departments ${activeOnly ? "WHERE is_active" : ""} ORDER BY id`);

export const getFundSources = (activeOnly = true) =>
  query<Named>(`SELECT id, name_en, name_ur FROM fund_sources ${activeOnly ? "WHERE is_active" : ""} ORDER BY id`);

export const getCategories = (activeOnly = true) =>
  query<Named>(`SELECT id, name_en, name_ur FROM item_categories ${activeOnly ? "WHERE is_active" : ""} ORDER BY name_en`);

export const getUnits = () => query<Named>("SELECT id, name_en, name_ur FROM units ORDER BY name_en");

export const getVendors = (activeOnly = true) =>
  query<{ id: number; name: string }>(`SELECT id, name FROM vendors ${activeOnly ? "WHERE is_active" : ""} ORDER BY name`);

export const getVehicles = (activeOnly = true) =>
  query<{ id: number; registration_no: string; make_model: string | null }>(
    `SELECT id, registration_no, make_model FROM vehicles ${activeOnly ? "WHERE is_active" : ""} ORDER BY registration_no`,
  );

export const getDrivers = (activeOnly = true) =>
  query<{ id: number; full_name: string }>(
    `SELECT id, full_name FROM drivers ${activeOnly ? "WHERE is_active" : ""} ORDER BY full_name`,
  );

export const getItemOptions = (activeOnly = true) =>
  query<ItemOption>(
    `SELECT i.id, i.code, i.name_en, i.name_ur, i.category_id, u.name_en AS unit_en, u.name_ur AS unit_ur, s.current_stock
       FROM items i JOIN units u ON u.id = i.unit_id JOIN v_item_stock s ON s.item_id = i.id
      ${activeOnly ? "WHERE i.is_active" : ""}
      ORDER BY i.name_en`,
  );

export const namedOptions = (rows: Named[], locale: Locale) => rows.map((r) => ({ value: r.id, label: nm(r, locale) }));

export const itemOptions = (rows: ItemOption[], locale: Locale, withStock = true) =>
  rows.map((r) => ({
    value: r.id,
    label: `${nm(r, locale)}${withStock ? ` (${fmtNum(r.current_stock)} ${locale === "ur" ? r.unit_ur : r.unit_en})` : ""}`,
  }));

export const vehicleOptions = (rows: Awaited<ReturnType<typeof getVehicles>>) =>
  rows.map((v) => ({ value: v.id, label: v.make_model ? `${v.registration_no} — ${v.make_model}` : v.registration_no }));

export const driverOptions = (rows: Awaited<ReturnType<typeof getDrivers>>) => rows.map((r) => ({ value: r.id, label: r.full_name }));

export async function getSetting<T = number>(key: string, fallback: T): Promise<T> {
  const row = (await query<{ value: T }>("SELECT value FROM app_settings WHERE key = $1", [key]))[0];
  return row ? row.value : fallback;
}
