import "server-only";
import ExcelJS from "exceljs";
import { query, tx, type Queryable } from "@/lib/db";
import { audit } from "@/lib/dal/auth";
import { fmt, fmtNum, tl, type Dictionary, type L, type Locale } from "@/lib/i18n";

// ───────────── Definitions ─────────────
type LookupKey = "category" | "unit" | "vendor" | "source" | "department" | "item" | "vehicle" | "driver";
type ColType = "text" | "number" | "date" | "time" | "bool" | { lookup: LookupKey };

export type ImportColumn = { key: string; label: L; type: ColType; required?: boolean; example: string | number };
type Row = Record<string, string | number | boolean | null> & { __row: number };
type RowError = { row: number; column: string; message: string };
type Ctx = { q: Queryable; userId: number; d: Dictionary; locale: Locale; errors: RowError[] };

export type ImportDef = {
  key: string;
  title: L;
  description: L;
  adminOnly: boolean;
  columns: ImportColumn[];
  /** Writes valid rows; pushes business-rule errors into ctx.errors. Returns a short summary. */
  commit: (rows: Row[], ctx: Ctx) => Promise<{ created: number; updated: number }>;
};

const col = (key: string, en: string, ur: string, type: ColType, example: string | number, required = false): ImportColumn => ({
  key,
  label: { en, ur },
  type,
  example,
  required,
});

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Karachi" }).format(new Date());

// Upsert by a natural key; returns whether a row was created or updated.
async function upsert(q: Queryable, table: string, matchSql: string, matchValue: unknown, values: Record<string, unknown>) {
  const [existing] = await q.query<{ id: number }>(`SELECT id FROM ${table} WHERE ${matchSql} LIMIT 1`, [matchValue]);
  const cols = Object.keys(values);
  if (existing) {
    await q.query(`UPDATE ${table} SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE id = $${cols.length + 1}`, [
      ...cols.map((c) => values[c]),
      existing.id,
    ]);
    return "updated" as const;
  }
  await q.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((c) => values[c]));
  return "created" as const;
}

/** Row values without the internal row-number field. */
const withoutRow = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "__row"));

const tally = (results: ("created" | "updated")[]) => ({
  created: results.filter((r) => r === "created").length,
  updated: results.filter((r) => r === "updated").length,
});

export const importers: ImportDef[] = [
  {
    key: "items",
    title: { en: "Items", ur: "اشیاء" },
    description: { en: "Add new items or update existing ones (matched by English name).", ur: "نئی اشیاء شامل کریں یا موجودہ اپ ڈیٹ کریں (انگریزی نام سے)۔" },
    adminOnly: true,
    columns: [
      col("name_en", "Name (English)", "نام (انگریزی)", "text", "Rice", true),
      col("name_ur", "Name (Urdu)", "نام (اردو)", "text", "چاول", true),
      col("category", "Category", "زمرہ", { lookup: "category" }, "Grocery / Ration", true),
      col("unit", "Unit", "اکائی", { lookup: "unit" }, "Kilogram", true),
      col("min_stock_level", "Minimum stock level", "کم از کم اسٹاک", "number", 50),
      col("reorder_qty", "Reorder quantity", "دوبارہ آرڈر مقدار", "number", 200),
      col("lead_time_days", "Lead time (days)", "فراہمی کا وقت (دن)", "number", 3),
      col("vendor", "Default vendor", "مستقل سپلائر", { lookup: "vendor" }, ""),
      col("is_perishable", "Perishable (yes/no)", "جلد خراب ہونے والی (ہاں/نہیں)", "bool", "no"),
    ],
    async commit(rows, { q }) {
      const out: ("created" | "updated")[] = [];
      for (const r of rows) {
        out.push(
          await upsert(q, "items", "lower(name_en) = lower($1)", r.name_en, {
            name_en: r.name_en,
            name_ur: r.name_ur,
            category_id: r.category,
            unit_id: r.unit,
            min_stock_level: r.min_stock_level ?? 0,
            reorder_qty: r.reorder_qty,
            lead_time_days: Math.round(Number(r.lead_time_days ?? 2)),
            default_vendor_id: r.vendor,
            is_perishable: r.is_perishable ?? false,
            is_active: true,
            updated_at: new Date(),
          }),
        );
      }
      return tally(out);
    },
  },
  {
    key: "stock-in",
    title: { en: "Stock received", ur: "وصول شدہ اسٹاک" },
    description: { en: "Record incoming stock, e.g. opening balances or a batch of receipts.", ur: "آنے والا اسٹاک درج کریں، مثلاً ابتدائی بقایا یا وصولیاں۔" },
    adminOnly: false,
    columns: [
      col("date", "Date", "تاریخ", "date", "01/10/2026", true),
      col("item", "Item", "شے", { lookup: "item" }, "Rice", true),
      col("quantity", "Quantity", "مقدار", "number", 100, true),
      col("source", "Source of stock", "اسٹاک کا ذریعہ", { lookup: "source" }, "General Donation", true),
      col("vendor", "Vendor", "سپلائر", { lookup: "vendor" }, ""),
      col("donor_name", "Donor name", "عطیہ دہندہ", "text", ""),
      col("unit_cost", "Unit cost (Rs)", "فی اکائی قیمت", "number", 280),
      col("reference_no", "Invoice / receipt no.", "بل / رسید نمبر", "text", "GRN-1001"),
      col("remarks", "Remarks", "تبصرہ", "text", ""),
    ],
    async commit(rows, { q, userId, d, errors }) {
      for (const r of rows) {
        if (Number(r.quantity) <= 0) {
          errors.push({ row: r.__row, column: "quantity", message: d.validation.positive });
          continue;
        }
        await q.query(
          `INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, fund_source_id, vendor_id, donor_name, unit_cost, reference_no, remarks, created_by)
           VALUES ('IN',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [r.item, r.date, r.quantity, r.source, r.vendor, r.donor_name, r.unit_cost, r.reference_no, r.remarks, userId],
        );
      }
      return { created: rows.length, updated: 0 };
    },
  },
  {
    key: "stock-out",
    title: { en: "Stock issued", ur: "جاری شدہ اسٹاک" },
    description: { en: "Record stock issued to departments. Rows that would make stock negative are rejected.", ur: "شعبوں کو جاری اسٹاک درج کریں۔ اسٹاک منفی کرنے والی قطاریں مسترد ہوں گی۔" },
    adminOnly: false,
    columns: [
      col("date", "Date", "تاریخ", "date", "01/10/2026", true),
      col("item", "Item", "شے", { lookup: "item" }, "Rice", true),
      col("quantity", "Quantity", "مقدار", "number", 7, true),
      col("department", "Department", "شعبہ", { lookup: "department" }, "Boys Hostel", true),
      col("issued_to", "Issued to", "وصول کنندہ", "text", "Hostel kitchen"),
      col("remarks", "Remarks", "تبصرہ", "text", ""),
    ],
    async commit(rows, { q, userId, d, errors }) {
      // Running balance per item, so the whole file is checked against current stock.
      const itemIds = [...new Set(rows.map((r) => Number(r.item)))];
      const balance = new Map<number, number>();
      for (const id of itemIds) {
        await q.query("SELECT id FROM items WHERE id = $1 FOR UPDATE", [id]);
        const [s] = await q.query<{ current_stock: number }>("SELECT current_stock FROM v_item_stock WHERE item_id = $1", [id]);
        balance.set(id, s?.current_stock ?? 0);
      }
      for (const r of rows) {
        const qty = Number(r.quantity);
        if (qty <= 0) {
          errors.push({ row: r.__row, column: "quantity", message: d.validation.positive });
          continue;
        }
        const available = balance.get(Number(r.item)) ?? 0;
        if (qty > available) {
          errors.push({ row: r.__row, column: "quantity", message: fmt(d.inventory.insufficient, { n: fmtNum(available) }) });
          continue;
        }
        balance.set(Number(r.item), available - qty);
        await q.query(
          `INSERT INTO stock_transactions (txn_type, item_id, txn_date, quantity, department_id, issued_to, remarks, created_by)
           VALUES ('OUT',$1,$2,$3,$4,$5,$6,$7)`,
          [r.item, r.date, qty, r.department, r.issued_to, r.remarks, userId],
        );
      }
      return { created: rows.length, updated: 0 };
    },
  },
  {
    key: "trips",
    title: { en: "Vehicle trips", ur: "گاڑی کے سفر" },
    description: { en: "Import completed trips, e.g. from a paper log book. Km driven is calculated automatically.", ur: "مکمل سفر درج کریں، مثلاً کاغذی لاگ بک سے۔ کلومیٹر خودکار حساب ہوں گے۔" },
    adminOnly: false,
    columns: [
      col("date", "Date", "تاریخ", "date", "01/10/2026", true),
      col("vehicle", "Vehicle number", "گاڑی نمبر", { lookup: "vehicle" }, "LEB-1234", true),
      col("driver", "Driver", "ڈرائیور", { lookup: "driver" }, "Muhammad Akram", true),
      col("department", "Department", "شعبہ", { lookup: "department" }, "School", true),
      col("purpose", "Purpose", "مقصد", "text", "School supplies pickup", true),
      col("destination", "Destination", "منزل", "text", "Main Bazar"),
      col("time_out", "Time out", "روانگی کا وقت", "time", "09:00", true),
      col("time_in", "Time in", "واپسی کا وقت", "time", "11:30", true),
      col("start_km", "Start km", "ابتدائی ریڈنگ", "number", 45210, true),
      col("end_km", "End km", "اختتامی ریڈنگ", "number", 45238, true),
    ],
    async commit(rows, { q, userId, d, errors }) {
      for (const r of rows) {
        if (Number(r.end_km) < Number(r.start_km)) {
          errors.push({ row: r.__row, column: "end_km", message: d.fleet.endBeforeStart });
          continue;
        }
        if (String(r.time_in) < String(r.time_out)) {
          errors.push({ row: r.__row, column: "time_in", message: d.fleet.timeBeforeStart });
          continue;
        }
        await q.query(
          `INSERT INTO vehicle_trips (vehicle_id, driver_id, department_id, trip_date, departed_at, returned_at, purpose, destination, start_km, end_km, created_by)
           VALUES ($1,$2,$3,$4::date,($4 || 'T' || $5)::timestamptz,($4 || 'T' || $6)::timestamptz,$7,$8,$9,$10,$11)`,
          [r.vehicle, r.driver, r.department, r.date, r.time_out, r.time_in, r.purpose, r.destination, r.start_km, r.end_km, userId],
        );
      }
      return { created: rows.length, updated: 0 };
    },
  },
  {
    key: "vendors",
    title: { en: "Vendors", ur: "سپلائرز" },
    description: { en: "Add or update suppliers (matched by name).", ur: "سپلائرز شامل یا اپ ڈیٹ کریں (نام سے)۔" },
    adminOnly: true,
    columns: [
      col("name", "Name", "نام", "text", "Al-Madina Traders", true),
      col("contact_person", "Contact person", "رابطہ کار", "text", "Haji Rafiq"),
      col("phone", "Phone", "فون", "text", "0300-1234567"),
      col("ntn_cnic", "NTN / CNIC", "این ٹی این / شناختی کارڈ", "text", ""),
      col("address", "Address", "پتہ", "text", "Main Bazar, Sheikhupura"),
      col("notes", "Notes", "نوٹس", "text", ""),
    ],
    async commit(rows, { q }) {
      const out: ("created" | "updated")[] = [];
      for (const r of rows) {
        out.push(await upsert(q, "vendors", "lower(name) = lower($1)", r.name, { ...withoutRow(r), is_active: true }));
      }
      return tally(out);
    },
  },
  {
    key: "vehicles",
    title: { en: "Vehicles", ur: "گاڑیاں" },
    description: { en: "Add or update vehicles (matched by vehicle number).", ur: "گاڑیاں شامل یا اپ ڈیٹ کریں (گاڑی نمبر سے)۔" },
    adminOnly: true,
    columns: [
      col("registration_no", "Vehicle number", "گاڑی نمبر", "text", "LEB-1234", true),
      col("make_model", "Make / model", "کمپنی / ماڈل", "text", "Toyota Hiace"),
      col("vehicle_type", "Type", "قسم", "text", "Van"),
      col("fuel_type", "Fuel (petrol/diesel/cng/electric)", "ایندھن", "text", "diesel"),
      col("seating_capacity", "Seats", "نشستیں", "number", 14),
      col("opening_odometer_km", "Opening odometer (km)", "ابتدائی میٹر ریڈنگ", "number", 45210),
    ],
    async commit(rows, { q, d, errors }) {
      const out: ("created" | "updated")[] = [];
      for (const r of rows) {
        const fuel = r.fuel_type ? String(r.fuel_type).toLowerCase() : null;
        if (fuel && !["petrol", "diesel", "cng", "electric"].includes(fuel)) {
          errors.push({ row: r.__row, column: "fuel_type", message: d.validation.invalid });
          continue;
        }
        out.push(
          await upsert(q, "vehicles", "upper(registration_no) = upper($1)", r.registration_no, {
            registration_no: String(r.registration_no).toUpperCase(),
            make_model: r.make_model,
            vehicle_type: r.vehicle_type,
            fuel_type: fuel,
            seating_capacity: r.seating_capacity === null ? null : Math.round(Number(r.seating_capacity)),
            opening_odometer_km: r.opening_odometer_km ?? 0,
            is_active: true,
          }),
        );
      }
      return tally(out);
    },
  },
  {
    key: "drivers",
    title: { en: "Drivers", ur: "ڈرائیورز" },
    description: { en: "Add or update drivers (matched by name).", ur: "ڈرائیورز شامل یا اپ ڈیٹ کریں (نام سے)۔" },
    adminOnly: true,
    columns: [
      col("full_name", "Full name", "پورا نام", "text", "Muhammad Akram", true),
      col("phone", "Phone", "فون", "text", "0301-5556667"),
      col("cnic", "CNIC", "شناختی کارڈ", "text", "35401-1234567-1"),
      col("license_no", "License no.", "لائسنس نمبر", "text", "LHR-123456"),
      col("license_expiry", "License expiry", "لائسنس کی میعاد", "date", "31/12/2027"),
    ],
    async commit(rows, { q }) {
      const out: ("created" | "updated")[] = [];
      for (const r of rows) {
        out.push(await upsert(q, "drivers", "lower(full_name) = lower($1)", r.full_name, { ...withoutRow(r), is_active: true }));
      }
      return tally(out);
    },
  },
];

export const getImporter = (key: string) => importers.find((i) => i.key === key);

// ───────────── Lookup lists (also used for template dropdowns) ─────────────
type LookupRow = { id: number; names: string[] };

async function loadLookups(): Promise<Record<LookupKey, LookupRow[]>> {
  const named = (sql: string) => query<{ id: number; a: string | null; b: string | null; c: string | null }>(sql);
  const toRows = (rows: { id: number; a: string | null; b: string | null; c: string | null }[]) =>
    rows.map((r) => ({ id: r.id, names: [r.a, r.b, r.c].filter((x): x is string => Boolean(x)) }));
  const [category, unit, vendor, source, department, item, vehicle, driver] = await Promise.all([
    named("SELECT id, name_en a, name_ur b, NULL c FROM item_categories WHERE is_active ORDER BY name_en"),
    named("SELECT id, name_en a, name_ur b, code c FROM units ORDER BY name_en"),
    named("SELECT id, name a, NULL b, NULL c FROM vendors WHERE is_active ORDER BY name"),
    named("SELECT id, name_en a, name_ur b, code c FROM fund_sources WHERE is_active ORDER BY id"),
    named("SELECT id, name_en a, name_ur b, code c FROM departments WHERE is_active ORDER BY id"),
    named("SELECT id, name_en a, name_ur b, code c FROM items WHERE is_active ORDER BY name_en"),
    named("SELECT id, registration_no a, NULL b, NULL c FROM vehicles WHERE is_active ORDER BY registration_no"),
    named("SELECT id, full_name a, cnic b, NULL c FROM drivers WHERE is_active ORDER BY full_name"),
  ]);
  return {
    category: toRows(category),
    unit: toRows(unit),
    vendor: toRows(vendor),
    source: toRows(source),
    department: toRows(department),
    item: toRows(item),
    vehicle: toRows(vehicle),
    driver: toRows(driver),
  };
}

const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

// ───────────── Template ─────────────
export async function buildTemplate(def: ImportDef, locale: Locale) {
  const lookups = await loadLookups();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tl(def.title, "en").slice(0, 31));
  const lists = wb.addWorksheet("Lists");

  ws.addRow(def.columns.map((c) => tl(c.label, locale) + (c.required ? " *" : "")));
  ws.addRow(def.columns.map((c) => c.example));
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF115E59" } };
  });
  ws.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };
  ws.views = [{ state: "frozen", ySplit: 1, rightToLeft: locale === "ur" }];

  let listCol = 0;
  def.columns.forEach((c, i) => {
    const column = ws.getColumn(i + 1);
    column.width = Math.max(tl(c.label, locale).length + 4, 16);
    if (c.type === "date") column.numFmt = "dd/mm/yyyy";
    if (typeof c.type === "object") {
      // Dropdown of valid values, kept on the "Lists" sheet.
      listCol += 1;
      const values = lookups[c.type.lookup].map((r) => r.names[0]);
      lists.getCell(1, listCol).value = tl(c.label, "en");
      lists.getCell(1, listCol).font = { bold: true };
      values.forEach((v, j) => (lists.getCell(j + 2, listCol).value = v));
      lists.getColumn(listCol).width = 28;
      if (values.length) {
        const letter = lists.getColumn(listCol).letter;
        for (let r = 2; r <= 1000; r++) {
          ws.getCell(r, i + 1).dataValidation = {
            type: "list",
            allowBlank: !c.required,
            formulae: [`Lists!$${letter}$2:$${letter}$${values.length + 1}`],
            showErrorMessage: true,
          };
        }
      }
    }
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ───────────── Parsing & import ─────────────
type CellValue = ExcelJS.CellValue;

function plain(v: CellValue): string | number | Date | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && !(v instanceof Date)) {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return (v.result as string | number | Date) ?? null;
    if ("error" in v) return null;
    return String(v);
  }
  return v as string | number | Date | boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function parseDate(v: string | number | Date): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : isoDate(v);
  if (typeof v === "number") return isoDate(new Date(Math.round((v - 25569) * 86400000))); // Excel serial
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // day first, as used in Pakistan
  if (m && +m[2] <= 12 && +m[1] <= 31) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

function parseTime(v: string | number | Date): string | null {
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  if (typeof v === "number" && v >= 0 && v < 1) {
    const mins = Math.round(v * 1440);
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  const m = String(v).trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = +m[1];
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
  return h < 24 && +m[2] < 60 ? `${pad(h)}:${m[2]}` : null;
}

export type ImportResult =
  | { ok: true; created: number; updated: number; rows: number }
  | { ok: false; error?: string; errors: RowError[] };

export async function runImport(def: ImportDef, file: ArrayBuffer, userId: number, locale: Locale, d: Dictionary): Promise<ImportResult> {
  const t = d.importer;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    return { ok: false, error: t.badFile, errors: [] };
  }
  const ws = wb.worksheets.find((s) => s.name !== "Lists" && s.actualRowCount > 0);
  if (!ws) return { ok: false, error: t.empty, errors: [] };

  // Map columns by header text (English or Urdu label, or key; "*" and case ignored).
  const headerIndex = new Map<string, number>();
  ws.getRow(1).eachCell((cell, colNumber) => {
    const h = norm(String(plain(cell.value) ?? "").replace(/\*/g, ""));
    const c = def.columns.find((c) => [c.key, c.label.en, c.label.ur].some((x) => norm(x) === h));
    if (c && !headerIndex.has(c.key)) headerIndex.set(c.key, colNumber);
  });
  const missing = def.columns.filter((c) => c.required && !headerIndex.has(c.key));
  if (missing.length) return { ok: false, error: fmt(t.missingColumns, { cols: missing.map((c) => tl(c.label, locale)).join("، ") }), errors: [] };

  const lookups = await loadLookups();
  const lookupMaps = Object.fromEntries(
    Object.entries(lookups).map(([k, rows]) => {
      const map = new Map<string, number>();
      for (const r of rows) for (const n of r.names) map.set(norm(n), r.id);
      return [k, map];
    }),
  ) as Record<LookupKey, Map<string, number>>;

  const errors: RowError[] = [];
  const rows: Row[] = [];
  const exampleRow = def.columns.map((c) => String(c.example));
  const label = (key: string) => tl(def.columns.find((c) => c.key === key)!.label, locale);

  for (let r = 2; r <= ws.rowCount; r++) {
    const raw = def.columns.map((c) => (headerIndex.has(c.key) ? plain(ws.getRow(r).getCell(headerIndex.get(c.key)!).value) : null));
    if (raw.every((v) => v === null || String(v).trim() === "")) continue;
    // Skip the template's example row if it was left unchanged.
    if (r === 2 && raw.every((v, i) => String(v ?? "") === exampleRow[i])) continue;

    const out: Row = { __row: r };
    def.columns.forEach((c, i) => {
      const v = raw[i];
      const blank = v === null || String(v).trim() === "";
      if (blank) {
        if (c.required) errors.push({ row: r, column: label(c.key), message: d.validation.required });
        out[c.key] = null;
        return;
      }
      if (c.type === "text") out[c.key] = String(v instanceof Date ? isoDate(v) : v).trim().slice(0, 500);
      else if (c.type === "number") {
        const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
        if (!Number.isFinite(n) || n < 0) errors.push({ row: r, column: label(c.key), message: d.validation.number });
        out[c.key] = n;
      } else if (c.type === "date") {
        const dt = parseDate(v as string | number | Date);
        if (!dt) errors.push({ row: r, column: label(c.key), message: d.validation.date });
        else if (dt > today() && def.key !== "drivers") errors.push({ row: r, column: label(c.key), message: t.futureDate });
        out[c.key] = dt;
      } else if (c.type === "time") {
        const tm = parseTime(v as string | number | Date);
        if (!tm) errors.push({ row: r, column: label(c.key), message: d.validation.invalid });
        out[c.key] = tm;
      } else if (c.type === "bool") {
        out[c.key] = ["yes", "y", "true", "1", "ہاں"].includes(norm(String(v)));
      } else {
        const id = lookupMaps[c.type.lookup].get(norm(String(v)));
        if (!id) errors.push({ row: r, column: label(c.key), message: fmt(t.notFound, { value: String(v) }) });
        out[c.key] = id ?? null;
      }
    });
    rows.push(out);
  }

  if (!rows.length && !errors.length) return { ok: false, error: t.empty, errors: [] };
  if (errors.length) return { ok: false, error: t.fixAndRetry, errors: errors.slice(0, 200) };

  try {
    const summary = await tx(async (q) => {
      const ctx: Ctx = { q, userId, d, locale, errors };
      const res = await def.commit(rows, ctx);
      if (errors.length) throw new RollbackForErrors();
      await audit(userId, "import", def.key, null, { rows: rows.length, ...res }, q);
      return res;
    });
    return { ok: true, rows: rows.length, ...summary };
  } catch (err) {
    if (err instanceof RollbackForErrors) {
      const named = errors.map((e) => ({ ...e, column: def.columns.find((c) => c.key === e.column) ? label(e.column) : e.column }));
      return { ok: false, error: t.fixAndRetry, errors: named.slice(0, 200) };
    }
    throw err;
  }
}

class RollbackForErrors extends Error {}
