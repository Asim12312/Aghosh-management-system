import "server-only";
import ExcelJS from "exceljs";
import { tl, type Locale } from "@/lib/i18n";
import type { Column, ColumnFormat, ReportResult } from "@/lib/reports";

const numFmt: Partial<Record<ColumnFormat, string>> = {
  num: "#,##0.###",
  km: "#,##0.0",
  money: "#,##0.00",
  pct: '0.0"%"',
  date: "dd/mm/yyyy",
};

const isNumeric = (c: Column) => ["num", "km", "money", "pct"].includes(c.format ?? "text");

/** 'YYYY-MM-DD' -> Date at UTC midnight, so Excel shows the same calendar day. */
const toDate = (v: string) => {
  const [y, m, d] = v.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Builds an .xlsx with a letterhead, the applied filters, a formatted table and a totals row. */
export async function reportToXlsx(opts: {
  result: ReportResult;
  locale: Locale;
  orgName: string;
  title: string;
  meta: { label: string; value: string }[];
  totalLabel: string;
}) {
  const { result, locale, orgName, title, meta, totalLabel } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = orgName;
  wb.created = new Date();
  // Sheet names: max 31 chars, no []:*?/\
  const ws = wb.addWorksheet(title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31));
  const cols = result.columns;
  const lastCol = Math.max(cols.length, 1);

  const banner = (text: string, size: number, bold: boolean) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, lastCol);
    row.getCell(1).font = { size, bold };
    row.getCell(1).alignment = { horizontal: "center" };
  };
  banner(orgName, 14, true);
  banner(title, 12, true);
  for (const m of meta) banner(`${m.label}: ${m.value.replace(/[⁦-⁩]/g, "")}`, 10, false);
  if (result.note) banner(tl(result.note, locale), 9, false);
  ws.addRow([]);

  const header = ws.addRow(cols.map((c) => tl(c.label, locale)));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF115E59" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin" } };
  });
  const headerRow = header.number;

  for (const r of result.rows) {
    ws.addRow(
      cols.map((c) => {
        const v = r[c.key];
        if (v === null || v === undefined || v === "") return null;
        if (c.format === "date") return toDate(String(v));
        return isNumeric(c) ? Number(v) : String(v);
      }),
    );
  }

  if (result.totals && result.rows.length) {
    const totals = ws.addRow(
      cols.map((c, i) => (i === 0 ? totalLabel : c.key in result.totals! ? (result.totals![c.key] as number | null) : null)),
    );
    totals.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cell.border = { top: { style: "thin" } };
    });
  }

  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (numFmt[c.format ?? "text"]) col.numFmt = numFmt[c.format ?? "text"]!;
    const longest = Math.max(
      tl(c.label, locale).length,
      ...result.rows.slice(0, 500).map((r) => String(r[c.key] ?? "").length),
    );
    col.width = Math.min(Math.max(longest + 2, c.format === "date" ? 12 : 8), 45);
  });

  ws.views = [{ state: "frozen", ySplit: headerRow, rightToLeft: locale === "ur" }];
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: lastCol } };
  ws.pageSetup = { paperSize: 9, orientation: cols.length > 7 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
