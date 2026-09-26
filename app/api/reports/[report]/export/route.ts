import { getCurrentUser } from "@/lib/dal/auth";
import { getSetting } from "@/lib/dal/lookups";
import { getReportLookups } from "@/lib/dal/report-lookups";
import { reportToXlsx } from "@/lib/excel";
import { getDictionary, isLocale, tl } from "@/lib/i18n";
import { getReport, parseReportFilters, type Cell } from "@/lib/reports";
import { describeFilters } from "@/components/report-view";

const csvCell = (v: Cell) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/reports/:report/export?format=xlsx|csv&locale=en|ur&<filters> */
export async function GET(request: Request, ctx: RouteContext<"/api/reports/[report]/export">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { report } = await ctx.params;
  const def = getReport(report);
  if (!def) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "en";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const filters = parseReportFilters(Object.fromEntries(url.searchParams));
  if (def.requires?.includes("item") && !filters.itemId) return new Response("Item is required", { status: 400 });

  const d = getDictionary(locale);
  const result = await def.run(filters, locale);
  const filename = `${def.key}_${filters.from}_${filters.to}.${format}`;
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (format === "xlsx") {
    const [lookups, orgName] = await Promise.all([
      getReportLookups(),
      getSetting<string>(locale === "ur" ? "org_name_ur" : "org_name_en", d.app.org),
    ]);
    const body = await reportToXlsx({
      result,
      locale,
      orgName,
      title: tl(def.title, locale),
      meta: [...describeFilters(def.filters, filters, lookups, locale), { label: d.common.generatedBy, value: user.full_name }],
      totalLabel: d.common.total,
    });
    return new Response(new Uint8Array(body), {
      headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }

  const lines = [result.columns.map((c) => csvCell(tl(c.label, locale))).join(",")];
  for (const row of result.rows) lines.push(result.columns.map((c) => csvCell(row[c.key])).join(","));
  if (result.totals) lines.push(result.columns.map((c, i) => (i === 0 ? d.common.total : csvCell(result.totals![c.key] ?? null))).join(","));
  // BOM so Excel opens Urdu text as UTF-8.
  return new Response("﻿" + lines.join("\r\n"), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });
}
