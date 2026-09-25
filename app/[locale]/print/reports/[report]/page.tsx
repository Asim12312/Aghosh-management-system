import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getSetting } from "@/lib/dal/lookups";
import { getReportLookups } from "@/lib/dal/report-lookups";
import { fmt, getDictionary, tl, type Locale } from "@/lib/i18n";
import { filtersToQuery, getReport, parseReportFilters } from "@/lib/reports";
import { describeFilters, ReportTable } from "@/components/report-view";
import { PrintDocument } from "@/components/print-layout";

export default async function PrintReportPage({ params, searchParams }: PageProps<"/[locale]/print/reports/[report]">) {
  const user = await requireUser();
  const { locale: loc, report: key } = await params;
  const locale = loc as Locale;
  const def = getReport(key);
  if (!def) notFound();
  const filters = parseReportFilters(await searchParams);
  if (def.requires?.includes("item") && !filters.itemId) redirect(`/${locale}/reports/${key}`);
  const d = getDictionary(locale);
  const [lookups, result, orgName] = await Promise.all([
    getReportLookups(),
    def.run(filters, locale),
    getSetting<string>(locale === "ur" ? "org_name_ur" : "org_name_en", d.app.org),
  ]);
  return (
    <PrintDocument
      locale={locale}
      orgName={orgName}
      title={tl(def.title, locale)}
      meta={[...describeFilters(def.filters, filters, lookups, locale), { label: d.common.total, value: fmt(d.reports.rows, { n: result.rows.length }) }]}
      generatedBy={user.full_name}
      landscape={def.landscape}
      backHref={`/${locale}/reports/${key}?${filtersToQuery(filters)}`}
    >
      <ReportTable result={result} locale={locale} dense />
      {result.note && <p className="mt-2 text-xs text-slate-500">{tl(result.note, locale)}</p>}
    </PrintDocument>
  );
}
