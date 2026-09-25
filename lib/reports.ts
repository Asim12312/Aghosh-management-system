import "server-only";
import { query } from "@/lib/db";
import { fmtTime, todayISO, type L, type Locale } from "@/lib/i18n";

// ───────────── Types ─────────────
export type FilterKey = "dateRange" | "vehicle" | "department" | "kmRange" | "item" | "category" | "fundSource" | "demandStatus";

export type ReportFilters = {
  from: string;
  to: string;
  vehicleId?: number;
  departmentId?: number;
  minKm?: number;
  maxKm?: number;
  itemId?: number;
  categoryId?: number;
  fundSourceId?: number;
  status?: string;
};

export type ColumnFormat = "text" | "num" | "km" | "money" | "date" | "pct";
export type Column = { key: string; label: L; format?: ColumnFormat; dir?: "ltr" };
export type Cell = string | number | null;
export type ReportRow = Record<string, Cell>;
export type ReportResult = { columns: Column[]; rows: ReportRow[]; totals?: ReportRow; note?: L };

export type ReportDef = {
  key: string;
  title: L;
  description: L;
  group: "inventory" | "demands" | "fleet";
  filters: FilterKey[];
  landscape?: boolean;
  /** Report cannot run without these filters. */
  requires?: FilterKey[];
  run: (f: ReportFilters, locale: Locale) => Promise<ReportResult>;
};

// ───────────── Filter parsing ─────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type SP = Record<string, string | string[] | undefined>;

export function parseReportFilters(sp: SP): ReportFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const int = (k: string) => (/^\d+$/.test(s(k)) ? Number(s(k)) : undefined);
  const dec = (k: string) => (s(k) !== "" && Number.isFinite(Number(s(k))) ? Number(s(k)) : undefined);
  const today = todayISO();
  const from = DATE_RE.test(s("from")) ? s("from") : today.slice(0, 8) + "01";
  const to = DATE_RE.test(s("to")) ? s("to") : today;
  const status = ["draft", "submitted", "approved", "partially_fulfilled", "fulfilled", "cancelled", "open"].includes(s("status"))
    ? s("status")
    : undefined;
  return {
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    vehicleId: int("vehicle"),
    departmentId: int("department"),
    minKm: dec("minKm"),
    maxKm: dec("maxKm"),
    itemId: int("item"),
    categoryId: int("category"),
    fundSourceId: int("source"),
    status,
  };
}

export function filtersToQuery(f: ReportFilters) {
  const q = new URLSearchParams({ from: f.from, to: f.to });
  if (f.vehicleId) q.set("vehicle", String(f.vehicleId));
  if (f.departmentId) q.set("department", String(f.departmentId));
  if (f.minKm !== undefined) q.set("minKm", String(f.minKm));
  if (f.maxKm !== undefined) q.set("maxKm", String(f.maxKm));
  if (f.itemId) q.set("item", String(f.itemId));
  if (f.categoryId) q.set("category", String(f.categoryId));
  if (f.fundSourceId) q.set("source", String(f.fundSourceId));
  if (f.status) q.set("status", f.status);
  return q.toString();
}

// ───────────── Helpers ─────────────
const pick = (locale: Locale, en: unknown, ur: unknown) => (locale === "ur" ? (ur ?? en) : (en ?? ur)) as string | null;
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const round = (v: number | null, digits = 2) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10 ** digits) / 10 ** digits);
const sum = (rows: ReportRow[], key: string) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

const C = {
  code: { key: "code", label: { en: "Code", ur: "کوڈ" }, dir: "ltr" } as Column,
  item: { key: "item", label: { en: "Item", ur: "شے" } } as Column,
  category: { key: "category", label: { en: "Category", ur: "زمرہ" } } as Column,
  unit: { key: "unit", label: { en: "Unit", ur: "اکائی" } } as Column,
  department: { key: "department", label: { en: "Department", ur: "شعبہ" } } as Column,
  vehicle: { key: "vehicle", label: { en: "Vehicle", ur: "گاڑی" }, dir: "ltr" } as Column,
  trips: { key: "trips", label: { en: "Trips", ur: "سفر" }, format: "num" } as Column,
  totalKm: { key: "total_km", label: { en: "Total km", ur: "کل کلومیٹر" }, format: "km" } as Column,
};

// ───────────── Reports ─────────────
const stockSummary: ReportDef = {
  key: "stock-summary",
  group: "inventory",
  title: { en: "Stock summary", ur: "اسٹاک کا خلاصہ" },
  description: {
    en: "Opening balance, stock received, issued and adjusted, and closing balance for each item.",
    ur: "ہر شے کا ابتدائی بقایا، وصولی، اجراء، درستگی اور اختتامی بقایا۔",
  },
  filters: ["dateRange", "category"],
  landscape: true,
  async run(f, locale) {
    const rows = await query(
      `WITH t AS (
         SELECT item_id, txn_date, txn_type, quantity, CASE WHEN txn_type = 'OUT' THEN -quantity ELSE quantity END AS signed
           FROM stock_transactions WHERE voided_at IS NULL AND txn_date <= $2)
       SELECT i.code, i.name_en, i.name_ur, c.name_en AS cat_en, c.name_ur AS cat_ur, u.name_en AS unit_en, u.name_ur AS unit_ur,
              COALESCE(SUM(t.signed) FILTER (WHERE t.txn_date < $1), 0) AS opening,
              COALESCE(SUM(t.quantity) FILTER (WHERE t.txn_date >= $1 AND t.txn_type = 'IN'), 0) AS received,
              COALESCE(SUM(t.quantity) FILTER (WHERE t.txn_date >= $1 AND t.txn_type = 'OUT'), 0) AS issued,
              COALESCE(SUM(t.quantity) FILTER (WHERE t.txn_date >= $1 AND t.txn_type = 'ADJUST'), 0) AS adjusted,
              COALESCE(SUM(t.signed), 0) AS closing, i.min_stock_level
         FROM items i
         JOIN item_categories c ON c.id = i.category_id
         JOIN units u ON u.id = i.unit_id
         LEFT JOIN t ON t.item_id = i.id
        WHERE i.is_active AND ($3::int IS NULL OR i.category_id = $3)
        GROUP BY i.id, c.name_en, c.name_ur, u.name_en, u.name_ur
        ORDER BY c.name_en, i.name_en`,
      [f.from, f.to, f.categoryId ?? null],
    );
    return {
      columns: [
        C.code,
        C.item,
        C.category,
        C.unit,
        { key: "opening", label: { en: "Opening", ur: "ابتدائی" }, format: "num" },
        { key: "received", label: { en: "Received", ur: "وصولی" }, format: "num" },
        { key: "issued", label: { en: "Issued", ur: "اجراء" }, format: "num" },
        { key: "adjusted", label: { en: "Adjusted", ur: "درستگی" }, format: "num" },
        { key: "closing", label: { en: "Closing", ur: "اختتامی" }, format: "num" },
        { key: "min", label: { en: "Minimum", ur: "کم از کم" }, format: "num" },
      ],
      rows: rows.map((r) => ({
        code: r.code as string,
        item: pick(locale, r.name_en, r.name_ur),
        category: pick(locale, r.cat_en, r.cat_ur),
        unit: pick(locale, r.unit_en, r.unit_ur),
        opening: n(r.opening),
        received: n(r.received),
        issued: n(r.issued),
        adjusted: n(r.adjusted),
        closing: n(r.closing),
        min: n(r.min_stock_level),
      })),
      note: { en: "Quantities are in each item's own unit, so columns are not totalled.", ur: "مقداریں ہر شے کی اپنی اکائی میں ہیں، اس لیے کالموں کا کل نہیں دیا گیا۔" },
    };
  },
};

const itemLedger: ReportDef = {
  key: "item-ledger",
  group: "inventory",
  title: { en: "Item stock ledger", ur: "شے کا اسٹاک کھاتہ" },
  description: { en: "Every entry for one item with a running balance.", ur: "ایک شے کے تمام اندراجات بمع بقایا۔" },
  filters: ["item", "dateRange"],
  requires: ["item"],
  async run(f, locale) {
    const [opening] = await query<{ bal: number }>(
      `SELECT COALESCE(SUM(CASE WHEN txn_type = 'OUT' THEN -quantity ELSE quantity END), 0) AS bal
         FROM stock_transactions WHERE item_id = $1 AND voided_at IS NULL AND txn_date < $2`,
      [f.itemId, f.from],
    );
    const rows = await query(
      `SELECT t.txn_date, t.txn_type, t.quantity, fs.name_en AS src_en, fs.name_ur AS src_ur, dp.name_en AS dept_en, dp.name_ur AS dept_ur,
              COALESCE(ds.demand_no, t.reference_no) AS reference, COALESCE(v.name, t.donor_name, t.issued_to) AS party, t.remarks
         FROM stock_transactions t
         LEFT JOIN fund_sources fs ON fs.id = t.fund_source_id
         LEFT JOIN departments dp ON dp.id = t.department_id
         LEFT JOIN vendors v ON v.id = t.vendor_id
         LEFT JOIN demand_items di ON di.id = t.demand_item_id
         LEFT JOIN demand_sheets ds ON ds.id = di.demand_sheet_id
        WHERE t.item_id = $1 AND t.voided_at IS NULL AND t.txn_date BETWEEN $2 AND $3
        ORDER BY t.txn_date, t.id`,
      [f.itemId, f.from, f.to],
    );
    let balance = opening?.bal ?? 0;
    const typeLabel = { IN: { en: "In", ur: "آمد" }, OUT: { en: "Out", ur: "اجراء" }, ADJUST: { en: "Adjust", ur: "درستگی" } } as const;
    const out: ReportRow[] = [
      { date: f.from, type: locale === "ur" ? "ابتدائی بقایا" : "Opening balance", detail: null, party: null, reference: null, in: null, out: null, balance },
    ];
    for (const r of rows) {
      const q = Number(r.quantity);
      const signed = r.txn_type === "OUT" ? -q : q;
      balance += signed;
      out.push({
        date: r.txn_date as string,
        type: typeLabel[r.txn_type as keyof typeof typeLabel][locale],
        detail: pick(locale, r.src_en ?? r.dept_en, r.src_ur ?? r.dept_ur) ?? (r.remarks as string | null),
        party: r.party as string | null,
        reference: r.reference as string | null,
        in: signed > 0 ? signed : null,
        out: signed < 0 ? -signed : null,
        balance: round(balance, 3),
      });
    }
    const totalIn = sum(out.slice(1), "in");
    const totalOut = sum(out.slice(1), "out");
    return {
      columns: [
        { key: "date", label: { en: "Date", ur: "تاریخ" }, format: "date" },
        { key: "type", label: { en: "Type", ur: "قسم" } },
        { key: "detail", label: { en: "Source / department", ur: "ذریعہ / شعبہ" } },
        { key: "party", label: { en: "Vendor / donor / recipient", ur: "سپلائر / عطیہ دہندہ / وصول کنندہ" } },
        { key: "reference", label: { en: "Reference", ur: "حوالہ" }, dir: "ltr" },
        { key: "in", label: { en: "In", ur: "آمد" }, format: "num" },
        { key: "out", label: { en: "Out", ur: "اجراء" }, format: "num" },
        { key: "balance", label: { en: "Balance", ur: "بقایا" }, format: "num" },
      ],
      rows: out,
      totals: { in: round(totalIn, 3), out: round(totalOut, 3), balance: round(balance, 3) },
    };
  },
};

const receiptsBySource: ReportDef = {
  key: "receipts-by-source",
  group: "inventory",
  title: { en: "Stock received by source", ur: "ذریعہ کے لحاظ سے وصول شدہ اسٹاک" },
  description: {
    en: "Stock received per source (e.g. General Donation, Alkhidmat Grant), with quantity and value.",
    ur: "ہر ذریعہ (مثلاً عمومی عطیہ، الخدمت گرانٹ) سے وصول شدہ اسٹاک، مقدار اور مالیت کے ساتھ۔",
  },
  filters: ["dateRange", "fundSource", "category"],
  async run(f, locale) {
    const rows = await query(
      `SELECT fs.name_en AS src_en, fs.name_ur AS src_ur, i.code, i.name_en, i.name_ur, u.name_en AS unit_en, u.name_ur AS unit_ur,
              COUNT(*)::int AS entries, SUM(t.quantity) AS qty, SUM(t.quantity * t.unit_cost) AS value
         FROM stock_transactions t
         JOIN fund_sources fs ON fs.id = t.fund_source_id
         JOIN items i ON i.id = t.item_id
         JOIN units u ON u.id = i.unit_id
        WHERE t.txn_type = 'IN' AND t.voided_at IS NULL AND t.txn_date BETWEEN $1 AND $2
          AND ($3::int IS NULL OR t.fund_source_id = $3) AND ($4::int IS NULL OR i.category_id = $4)
        GROUP BY fs.id, i.id, u.id
        ORDER BY fs.id, i.name_en`,
      [f.from, f.to, f.fundSourceId ?? null, f.categoryId ?? null],
    );
    const out = rows.map((r) => ({
      source: pick(locale, r.src_en, r.src_ur),
      code: r.code as string,
      item: pick(locale, r.name_en, r.name_ur),
      qty: n(r.qty),
      unit: pick(locale, r.unit_en, r.unit_ur),
      entries: n(r.entries),
      value: round(n(r.value)),
    }));
    return {
      columns: [
        { key: "source", label: { en: "Source", ur: "ذریعہ" } },
        C.code,
        C.item,
        { key: "qty", label: { en: "Quantity", ur: "مقدار" }, format: "num" },
        C.unit,
        { key: "entries", label: { en: "Entries", ur: "اندراجات" }, format: "num" },
        { key: "value", label: { en: "Value (Rs)", ur: "مالیت (روپے)" }, format: "money" },
      ],
      rows: out,
      totals: { entries: sum(out, "entries"), value: round(sum(out, "value")) },
      note: { en: "Value is shown only where a unit cost was recorded.", ur: "مالیت صرف وہاں دکھائی گئی ہے جہاں فی اکائی قیمت درج تھی۔" },
    };
  },
};

const consumptionByDepartment: ReportDef = {
  key: "consumption-by-department",
  group: "inventory",
  title: { en: "Consumption by department", ur: "شعبہ وار استعمال" },
  description: { en: "Stock issued to each department over the period.", ur: "مدت کے دوران ہر شعبے کو جاری کردہ اسٹاک۔" },
  filters: ["dateRange", "department", "category"],
  async run(f, locale) {
    const rows = await query(
      `SELECT dp.name_en AS dept_en, dp.name_ur AS dept_ur, i.code, i.name_en, i.name_ur, u.name_en AS unit_en, u.name_ur AS unit_ur,
              COUNT(*)::int AS entries, SUM(t.quantity) AS qty
         FROM stock_transactions t
         JOIN departments dp ON dp.id = t.department_id
         JOIN items i ON i.id = t.item_id
         JOIN units u ON u.id = i.unit_id
        WHERE t.txn_type = 'OUT' AND t.voided_at IS NULL AND t.txn_date BETWEEN $1 AND $2
          AND ($3::int IS NULL OR t.department_id = $3) AND ($4::int IS NULL OR i.category_id = $4)
        GROUP BY dp.id, i.id, u.id
        ORDER BY dp.id, i.name_en`,
      [f.from, f.to, f.departmentId ?? null, f.categoryId ?? null],
    );
    return {
      columns: [
        C.department,
        C.code,
        C.item,
        { key: "qty", label: { en: "Quantity issued", ur: "جاری شدہ مقدار" }, format: "num" },
        C.unit,
        { key: "entries", label: { en: "Entries", ur: "اندراجات" }, format: "num" },
      ],
      rows: rows.map((r) => ({
        department: pick(locale, r.dept_en, r.dept_ur),
        code: r.code as string,
        item: pick(locale, r.name_en, r.name_ur),
        qty: n(r.qty),
        unit: pick(locale, r.unit_en, r.unit_ur),
        entries: n(r.entries),
      })),
    };
  },
};

const lowStock: ReportDef = {
  key: "low-stock",
  group: "inventory",
  title: { en: "Low stock / reorder list", ur: "کم اسٹاک / دوبارہ آرڈر فہرست" },
  description: {
    en: "Items below their minimum level or expected to reach it soon, with suggested reorder quantity.",
    ur: "وہ اشیاء جو کم از کم حد سے نیچے ہیں یا جلد پہنچ جائیں گی، تجویز کردہ آرڈر مقدار کے ساتھ۔",
  },
  filters: ["category"],
  async run(f, locale) {
    const rows = await query(
      `SELECT a.code, a.name_en, a.name_ur, u.name_en AS unit_en, u.name_ur AS unit_ur, a.current_stock, a.min_stock_level,
              a.avg_daily_out, a.days_of_cover, a.alert_level, i.reorder_qty, v.name AS vendor, v.phone
         FROM v_stock_alerts a
         JOIN items i ON i.id = a.item_id
         JOIN units u ON u.id = a.unit_id
         LEFT JOIN vendors v ON v.id = i.default_vendor_id
        WHERE ($1::int IS NULL OR i.category_id = $1)
        ORDER BY CASE a.alert_level WHEN 'OUT_OF_STOCK' THEN 0 WHEN 'BELOW_MIN' THEN 1 ELSE 2 END, a.days_of_cover NULLS FIRST`,
      [f.categoryId ?? null],
    );
    const level = {
      OUT_OF_STOCK: { en: "Out of stock", ur: "ختم" },
      BELOW_MIN: { en: "Below minimum", ur: "حد سے کم" },
      RUNNING_LOW: { en: "Running low", ur: "کم ہو رہا ہے" },
    } as const;
    return {
      columns: [
        C.code,
        C.item,
        { key: "stock", label: { en: "In stock", ur: "موجود" }, format: "num" },
        { key: "min", label: { en: "Minimum", ur: "کم از کم" }, format: "num" },
        C.unit,
        { key: "daily", label: { en: "Avg. daily use", ur: "اوسط یومیہ" }, format: "num" },
        { key: "cover", label: { en: "Days of cover", ur: "باقی دن" }, format: "num" },
        { key: "status", label: { en: "Status", ur: "حیثیت" } },
        { key: "reorder", label: { en: "Suggested order", ur: "تجویز کردہ آرڈر" }, format: "num" },
        { key: "vendor", label: { en: "Vendor", ur: "سپلائر" } },
      ],
      rows: rows.map((r) => {
        const stock = Number(r.current_stock);
        const min = Number(r.min_stock_level);
        const suggested = r.reorder_qty !== null ? Number(r.reorder_qty) : Math.max(min * 2 - stock, 0);
        return {
          code: r.code as string,
          item: pick(locale, r.name_en, r.name_ur),
          stock,
          min,
          unit: pick(locale, r.unit_en, r.unit_ur),
          daily: round(n(r.avg_daily_out)),
          cover: n(r.days_of_cover),
          status: level[r.alert_level as keyof typeof level][locale],
          reorder: round(suggested, 3),
          vendor: [r.vendor, r.phone].filter(Boolean).join(" · ") || null,
        };
      }),
    };
  },
};

const demandStatus: ReportDef = {
  key: "demand-status",
  group: "demands",
  title: { en: "Demand sheet status", ur: "ڈیمانڈ شیٹس کی صورتحال" },
  description: {
    en: "Demand lines required within the period, split by boys and girls, with quantities issued and pending.",
    ur: "مدت کے اندر درکار ڈیمانڈز، لڑکوں اور لڑکیوں کی تقسیم کے ساتھ، جاری شدہ اور باقی مقدار۔",
  },
  filters: ["dateRange", "department", "demandStatus"],
  landscape: true,
  async run(f, locale) {
    const rows = await query(
      `SELECT ds.demand_no, ds.created_on, ds.required_by, ds.status, dp.name_en AS dept_en, dp.name_ur AS dept_ur,
              i.name_en, i.name_ur, u.name_en AS unit_en, u.name_ur AS unit_ur, p.qty_boys, p.qty_girls, p.qty_total, p.qty_issued
         FROM demand_sheets ds
         JOIN v_demand_item_progress p ON p.demand_sheet_id = ds.id
         JOIN items i ON i.id = p.item_id
         JOIN units u ON u.id = i.unit_id
         LEFT JOIN departments dp ON dp.id = ds.department_id
        WHERE ds.required_by BETWEEN $1 AND $2
          AND ($3::int IS NULL OR ds.department_id = $3)
          AND ($4::text IS NULL OR ($4 = 'open' AND ds.status IN ('submitted','approved','partially_fulfilled')) OR ds.status::text = $4)
        ORDER BY ds.required_by, ds.demand_no, i.name_en`,
      [f.from, f.to, f.departmentId ?? null, f.status ?? null],
    );
    const statuses: Record<string, L> = {
      draft: { en: "Draft", ur: "مسودہ" },
      submitted: { en: "Submitted", ur: "جمع شدہ" },
      approved: { en: "Approved", ur: "منظور شدہ" },
      partially_fulfilled: { en: "Partially fulfilled", ur: "جزوی مکمل" },
      fulfilled: { en: "Fulfilled", ur: "مکمل" },
      cancelled: { en: "Cancelled", ur: "منسوخ" },
    };
    return {
      columns: [
        { key: "demand_no", label: { en: "Demand no.", ur: "ڈیمانڈ نمبر" }, dir: "ltr" },
        { key: "created_on", label: { en: "Created", ur: "اندراج" }, format: "date" },
        { key: "required_by", label: { en: "Required by", ur: "درکار بتاریخ" }, format: "date" },
        C.department,
        { key: "status", label: { en: "Status", ur: "حیثیت" } },
        C.item,
        { key: "boys", label: { en: "Boys", ur: "لڑکے" }, format: "num" },
        { key: "girls", label: { en: "Girls", ur: "لڑکیاں" }, format: "num" },
        { key: "total", label: { en: "Total", ur: "کل" }, format: "num" },
        { key: "issued", label: { en: "Issued", ur: "جاری" }, format: "num" },
        { key: "pending", label: { en: "Pending", ur: "باقی" }, format: "num" },
        C.unit,
      ],
      rows: rows.map((r) => ({
        demand_no: r.demand_no as string,
        created_on: r.created_on as string,
        required_by: r.required_by as string,
        department: pick(locale, r.dept_en, r.dept_ur),
        status: statuses[r.status as string][locale],
        item: pick(locale, r.name_en, r.name_ur),
        boys: n(r.qty_boys),
        girls: n(r.qty_girls),
        total: n(r.qty_total),
        issued: n(r.qty_issued),
        pending: Math.max(Number(r.qty_total) - Number(r.qty_issued), 0),
        unit: pick(locale, r.unit_en, r.unit_ur),
      })),
    };
  },
};

const tripSql = `
  SELECT t.*, v.registration_no, dr.full_name AS driver_name, dp.name_en AS dept_en, dp.name_ur AS dept_ur
    FROM vehicle_trips t
    JOIN vehicles v ON v.id = t.vehicle_id
    JOIN drivers dr ON dr.id = t.driver_id
    JOIN departments dp ON dp.id = t.department_id
   WHERE t.end_km IS NOT NULL AND t.trip_date BETWEEN $1 AND $2
     AND ($3::int IS NULL OR t.vehicle_id = $3)
     AND ($4::int IS NULL OR t.department_id = $4)
     AND ($5::numeric IS NULL OR t.distance_km >= $5)
     AND ($6::numeric IS NULL OR t.distance_km <= $6)`;
const tripParams = (f: ReportFilters) => [f.from, f.to, f.vehicleId ?? null, f.departmentId ?? null, f.minKm ?? null, f.maxKm ?? null];

const tripLog: ReportDef = {
  key: "trip-log",
  group: "fleet",
  title: { en: "Vehicle trip log", ur: "گاڑی کا سفری ریکارڈ" },
  description: {
    en: "All completed trips with driver, purpose, times, meter readings and km driven.",
    ur: "تمام مکمل سفر: ڈرائیور، مقصد، اوقات، میٹر ریڈنگ اور طے شدہ کلومیٹر۔",
  },
  filters: ["dateRange", "vehicle", "department", "kmRange"],
  landscape: true,
  async run(f, locale) {
    const rows = await query(`${tripSql} ORDER BY t.departed_at`, tripParams(f));
    const time = (d: unknown) => (d ? fmtTime(d as Date) : null);
    const out = rows.map((r) => ({
      date: r.trip_date as string,
      vehicle: r.registration_no as string,
      driver: r.driver_name as string,
      department: pick(locale, r.dept_en, r.dept_ur),
      purpose: [r.purpose, r.destination].filter(Boolean).join(" — "),
      time_from: time(r.departed_at),
      time_to: time(r.returned_at),
      start_km: n(r.start_km),
      end_km: n(r.end_km),
      distance: n(r.distance_km),
    }));
    return {
      columns: [
        { key: "date", label: { en: "Date", ur: "تاریخ" }, format: "date" },
        C.vehicle,
        { key: "driver", label: { en: "Driver", ur: "ڈرائیور" } },
        C.department,
        { key: "purpose", label: { en: "Purpose", ur: "مقصد" } },
        { key: "time_from", label: { en: "Time out", ur: "روانگی" }, dir: "ltr" },
        { key: "time_to", label: { en: "Time in", ur: "واپسی" }, dir: "ltr" },
        { key: "start_km", label: { en: "Start km", ur: "ابتدائی" }, format: "km" },
        { key: "end_km", label: { en: "End km", ur: "اختتامی" }, format: "km" },
        { key: "distance", label: { en: "Km driven", ur: "کلومیٹر" }, format: "km" },
      ],
      rows: out,
      totals: { distance: round(sum(out, "distance"), 1) },
    };
  },
};

const vehicleUsage: ReportDef = {
  key: "vehicle-usage",
  group: "fleet",
  title: { en: "Vehicle usage & mileage", ur: "گاڑیوں کا استعمال اور ایندھن اوسط" },
  description: {
    en: "Per vehicle: trips, total km, average km per trip and per day, km per litre and fuel cost per km.",
    ur: "ہر گاڑی: سفر، کل کلومیٹر، فی سفر اور یومیہ اوسط، فی لیٹر کلومیٹر اور فی کلومیٹر لاگت۔",
  },
  filters: ["dateRange", "vehicle", "department", "kmRange"],
  landscape: true,
  async run(f) {
    const rows = await query(
      `WITH t AS (${tripSql}),
       fuel AS (SELECT vehicle_id, SUM(litres) AS litres, SUM(amount) AS cost FROM fuel_logs WHERE fill_date BETWEEN $1 AND $2 GROUP BY vehicle_id)
       SELECT t.registration_no, COUNT(*)::int AS trips, SUM(t.distance_km) AS total_km, AVG(t.distance_km) AS avg_trip,
              SUM(t.distance_km) / NULLIF(COUNT(DISTINCT t.trip_date), 0) AS avg_day, fuel.litres, fuel.cost
         FROM t LEFT JOIN fuel ON fuel.vehicle_id = t.vehicle_id
        GROUP BY t.vehicle_id, t.registration_no, fuel.litres, fuel.cost
        ORDER BY total_km DESC`,
      tripParams(f),
    );
    // Fuel is bought per vehicle, not per department or trip size, so fuel ratios only make sense unfiltered.
    const fuelComparable = !f.departmentId && f.minKm === undefined && f.maxKm === undefined;
    const out = rows.map((r) => {
      const km = Number(r.total_km);
      const litres = n(r.litres);
      const cost = n(r.cost);
      return {
        vehicle: r.registration_no as string,
        trips: n(r.trips),
        total_km: round(km, 1),
        avg_trip: round(n(r.avg_trip), 1),
        avg_day: round(n(r.avg_day), 1),
        litres: fuelComparable ? round(litres) : null,
        km_per_litre: fuelComparable && litres ? round(km / litres) : null,
        fuel_cost: fuelComparable ? round(cost) : null,
        cost_per_km: fuelComparable && cost && km ? round(cost / km) : null,
      };
    });
    const totalKm = sum(out, "total_km");
    const totalTrips = sum(out, "trips");
    return {
      columns: [
        C.vehicle,
        C.trips,
        C.totalKm,
        { key: "avg_trip", label: { en: "Avg km / trip", ur: "اوسط فی سفر" }, format: "km" },
        { key: "avg_day", label: { en: "Avg km / active day", ur: "اوسط یومیہ" }, format: "km" },
        { key: "litres", label: { en: "Fuel (L)", ur: "ایندھن (لیٹر)" }, format: "money" },
        { key: "km_per_litre", label: { en: "Km / litre", ur: "کلومیٹر فی لیٹر" }, format: "money" },
        { key: "fuel_cost", label: { en: "Fuel cost (Rs)", ur: "ایندھن لاگت (روپے)" }, format: "money" },
        { key: "cost_per_km", label: { en: "Rs / km", ur: "روپے فی کلومیٹر" }, format: "money" },
      ],
      rows: out,
      totals: {
        trips: totalTrips,
        total_km: round(totalKm, 1),
        avg_trip: totalTrips ? round(totalKm / totalTrips, 1) : null,
        litres: fuelComparable ? round(sum(out, "litres")) : null,
        fuel_cost: fuelComparable ? round(sum(out, "fuel_cost")) : null,
      },
      note: fuelComparable
        ? { en: "Km per litre uses fuel purchased in the period; log every fill for accurate figures.", ur: "فی لیٹر کلومیٹر مدت کے دوران خریدے گئے ایندھن پر مبنی ہے؛ درست اعداد کے لیے ہر خریداری درج کریں۔" }
        : { en: "Fuel figures are hidden when filtering by department or km, because fuel is recorded per vehicle.", ur: "شعبہ یا کلومیٹر فلٹر پر ایندھن کے اعداد نہیں دکھائے جاتے کیونکہ ایندھن گاڑی کے حساب سے درج ہوتا ہے۔" },
    };
  },
};

const departmentKm: ReportDef = {
  key: "department-km",
  group: "fleet",
  title: { en: "Kilometres by department", ur: "شعبہ وار کلومیٹر" },
  description: {
    en: "Trips and kilometres allocated to Boys Hostel, Girls Hostel, School and other departments.",
    ur: "بوائز ہاسٹل، گرلز ہاسٹل، اسکول اور دیگر شعبوں کے سفر اور کلومیٹر۔",
  },
  filters: ["dateRange", "vehicle", "department", "kmRange"],
  async run(f, locale) {
    const rows = await query(
      `WITH t AS (${tripSql})
       SELECT t.dept_en, t.dept_ur, t.registration_no, COUNT(*)::int AS trips, SUM(t.distance_km) AS total_km
         FROM t GROUP BY t.department_id, t.dept_en, t.dept_ur, t.vehicle_id, t.registration_no
        ORDER BY t.department_id, total_km DESC`,
      tripParams(f),
    );
    const grand = rows.reduce((a, r) => a + Number(r.total_km), 0);
    const out = rows.map((r) => ({
      department: pick(locale, r.dept_en, r.dept_ur),
      vehicle: r.registration_no as string,
      trips: n(r.trips),
      total_km: round(n(r.total_km), 1),
      share: grand ? round((Number(r.total_km) / grand) * 100, 1) : null,
    }));
    return {
      columns: [C.department, C.vehicle, C.trips, C.totalKm, { key: "share", label: { en: "Share of km", ur: "حصہ" }, format: "pct" }],
      rows: out,
      totals: { trips: sum(out, "trips"), total_km: round(grand, 1), share: grand ? 100 : null },
    };
  },
};

export const reports: ReportDef[] = [
  stockSummary,
  itemLedger,
  receiptsBySource,
  consumptionByDepartment,
  lowStock,
  demandStatus,
  tripLog,
  vehicleUsage,
  departmentKm,
];

export const getReport = (key: string) => reports.find((r) => r.key === key);
