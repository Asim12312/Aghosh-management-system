import { fmtDate, fmtKm, fmtMoney, fmtNum, getDictionary, nm, tl, type Locale } from "@/lib/i18n";
import type { Cell, Column, FilterKey, ReportFilters, ReportResult } from "@/lib/reports";
import type { ItemOption, Named } from "@/lib/dal/lookups";
import { buttonCls, cx, EmptyRow, inputCls, Table, Td, Th } from "./ui";

export type ReportLookups = {
  vehicles: { id: number; registration_no: string }[];
  departments: Named[];
  items: ItemOption[];
  categories: Named[];
  sources: Named[];
};

const isNumeric = (c: Column) => ["num", "km", "money", "pct"].includes(c.format ?? "text");

export function formatCell(c: Column, v: Cell) {
  if (v === null || v === undefined || v === "") return "—";
  switch (c.format) {
    case "num":
      return fmtNum(Number(v));
    case "km":
      return fmtKm(Number(v));
    case "money":
      return fmtMoney(Number(v));
    case "pct":
      return `${fmtKm(Number(v))}%`;
    case "date":
      return fmtDate(String(v));
    default:
      return String(v);
  }
}

export function ReportTable({ result, locale, dense = false }: { result: ReportResult; locale: Locale; dense?: boolean }) {
  const d = getDictionary(locale);
  const { columns, rows, totals } = result;
  return (
    <Table className={dense ? "text-[9.5pt]" : undefined}>
      <thead>
        <tr>
          {columns.map((c) => (
            <Th key={c.key} numeric={isNumeric(c)}>
              {tl(c.label, locale)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={columns.length}>{d.common.noRecords}</EmptyRow>}
        {rows.map((r, i) => (
          <tr key={i} className="even:bg-slate-50/60 print:even:bg-transparent">
            {columns.map((c) => (
              <Td
                key={c.key}
                numeric={isNumeric(c)}
                className={cx((isNumeric(c) || c.format === "date" || c.dir === "ltr") && "ltr-nums", c.format === "date" && "whitespace-nowrap")}
              >
                {formatCell(c, r[c.key])}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
      {totals && rows.length > 0 && (
        <tfoot>
          <tr className="bg-slate-100 font-semibold">
            {columns.map((c, i) => (
              <Td key={c.key} numeric={isNumeric(c)} className={isNumeric(c) ? "ltr-nums" : undefined}>
                {i === 0 ? d.common.total : c.key in totals ? formatCell(c, totals[c.key]) : ""}
              </Td>
            ))}
          </tr>
        </tfoot>
      )}
    </Table>
  );
}

export function ReportFilterForm({
  filters,
  values,
  lookups,
  locale,
}: {
  filters: FilterKey[];
  values: ReportFilters;
  lookups: ReportLookups;
  locale: Locale;
}) {
  const d = getDictionary(locale);
  const r = d.reports;
  const label = "mb-1 block text-sm font-medium text-slate-700";
  const select = (name: string, text: string, value: number | string | undefined, options: { value: string | number; label: string }[]) => (
    <div className="min-w-44">
      <label className={label} htmlFor={`rf-${name}`}>{text}</label>
      <select id={`rf-${name}`} name={name} defaultValue={value ?? ""} className={inputCls}>
        <option value="">{d.common.all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
  return (
    <form className="flex flex-wrap items-end gap-3">
      {filters.includes("item") && (
        <div className="min-w-64">
          <label className={label} htmlFor="rf-item">{r.item}</label>
          <select id="rf-item" name="item" defaultValue={values.itemId ?? ""} className={inputCls}>
            <option value="">{d.common.select}</option>
            {lookups.items.map((i) => (
              <option key={i.id} value={i.id}>{nm(i, locale)}</option>
            ))}
          </select>
        </div>
      )}
      {filters.includes("dateRange") && (
        <>
          <div>
            <label className={label} htmlFor="rf-from">{d.common.from}</label>
            <input id="rf-from" type="date" name="from" defaultValue={values.from} className={inputCls} />
          </div>
          <div>
            <label className={label} htmlFor="rf-to">{d.common.to}</label>
            <input id="rf-to" type="date" name="to" defaultValue={values.to} className={inputCls} />
          </div>
        </>
      )}
      {filters.includes("vehicle") &&
        select("vehicle", r.vehicle, values.vehicleId, lookups.vehicles.map((v) => ({ value: v.id, label: v.registration_no })))}
      {filters.includes("department") &&
        select("department", r.department, values.departmentId, lookups.departments.map((x) => ({ value: x.id, label: nm(x, locale) })))}
      {filters.includes("category") &&
        select("category", r.category, values.categoryId, lookups.categories.map((x) => ({ value: x.id, label: nm(x, locale) })))}
      {filters.includes("fundSource") &&
        select("source", r.fundSource, values.fundSourceId, lookups.sources.map((x) => ({ value: x.id, label: nm(x, locale) })))}
      {filters.includes("demandStatus") &&
        select("status", r.status, values.status, [
          { value: "open", label: d.dashboard.pending },
          ...(Object.keys(d.demands.statuses) as (keyof typeof d.demands.statuses)[]).map((s) => ({ value: s, label: d.demands.statuses[s] })),
        ])}
      {filters.includes("kmRange") && (
        <>
          <div className="w-36">
            <label className={label} htmlFor="rf-minKm">{r.minKm}</label>
            <input id="rf-minKm" name="minKm" inputMode="decimal" defaultValue={values.minKm} className={cx(inputCls, "ltr-nums")} />
          </div>
          <div className="w-36">
            <label className={label} htmlFor="rf-maxKm">{r.maxKm}</label>
            <input id="rf-maxKm" name="maxKm" inputMode="decimal" defaultValue={values.maxKm} className={cx(inputCls, "ltr-nums")} />
          </div>
        </>
      )}
      <button className={buttonCls("primary")}>{r.run}</button>
    </form>
  );
}

/** Keeps ranges like "01/09 – 23/09" in reading order inside Urdu (RTL) text. */
const ltr = (s: string) => "⁦" + s + "⁩";

/** Human-readable list of the filters applied, for the printed header. */
export function describeFilters(filters: FilterKey[], f: ReportFilters, lookups: ReportLookups, locale: Locale) {
  const d = getDictionary(locale);
  const r = d.reports;
  const parts: { label: string; value: string }[] = [];
  if (filters.includes("item") && f.itemId) {
    const item = lookups.items.find((i) => i.id === f.itemId);
    if (item) parts.push({ label: r.item, value: nm(item, locale) });
  }
  if (filters.includes("dateRange")) parts.push({ label: d.common.date, value: ltr(`${fmtDate(f.from)} – ${fmtDate(f.to)}`) });
  const named = (key: FilterKey, label: string, id: number | undefined, list: Named[]) => {
    if (!filters.includes(key)) return;
    const row = id ? list.find((x) => x.id === id) : undefined;
    parts.push({ label, value: row ? nm(row, locale) : d.common.all });
  };
  if (filters.includes("vehicle"))
    parts.push({ label: r.vehicle, value: lookups.vehicles.find((v) => v.id === f.vehicleId)?.registration_no ?? d.common.all });
  named("department", r.department, f.departmentId, lookups.departments);
  named("category", r.category, f.categoryId, lookups.categories);
  named("fundSource", r.fundSource, f.fundSourceId, lookups.sources);
  if (filters.includes("demandStatus"))
    parts.push({
      label: r.status,
      value: !f.status ? d.common.all : f.status === "open" ? d.dashboard.pending : d.demands.statuses[f.status as keyof typeof d.demands.statuses],
    });
  if (filters.includes("kmRange") && (f.minKm !== undefined || f.maxKm !== undefined))
    parts.push({ label: d.fleet.distance, value: ltr(`${f.minKm ?? 0} – ${f.maxKm ?? "∞"} km`) });
  return parts;
}
