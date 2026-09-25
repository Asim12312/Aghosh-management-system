import { getCurrentUser } from "@/lib/dal/auth";
import { isLocale, tl } from "@/lib/i18n";
import { getReport, parseReportFilters, type Cell } from "@/lib/reports";

const csvCell = (v: Cell) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request, ctx: RouteContext<"/api/reports/[report]/export">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { report } = await ctx.params;
  const def = getReport(report);
  if (!def) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "en";
  const filters = parseReportFilters(Object.fromEntries(url.searchParams));
  if (def.requires?.includes("item") && !filters.itemId) return new Response("Item is required", { status: 400 });

  const result = await def.run(filters, locale);
  const lines = [result.columns.map((c) => csvCell(tl(c.label, locale))).join(",")];
  for (const row of result.rows) lines.push(result.columns.map((c) => csvCell(row[c.key])).join(","));
  if (result.totals) lines.push(result.columns.map((c, i) => (i === 0 ? "Total" : csvCell(result.totals![c.key] ?? null))).join(","));

  // BOM so Excel opens Urdu text as UTF-8.
  const body = "﻿" + lines.join("\r\n");
  const filename = `${def.key}_${filters.from}_${filters.to}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
