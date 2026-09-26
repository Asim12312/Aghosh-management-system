import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getReportLookups } from "@/lib/dal/report-lookups";
import { fmt, getDictionary, tl, type Locale } from "@/lib/i18n";
import { filtersToQuery, getReport, parseReportFilters } from "@/lib/reports";
import { ReportFilterForm, ReportTable } from "@/components/report-view";
import { buttonCls, Card, LinkButton, PageHeader } from "@/components/ui";

export default async function ReportPage({ params, searchParams }: PageProps<"/[locale]/reports/[report]">) {
  await requireUser();
  const { locale: loc, report: key } = await params;
  const locale = loc as Locale;
  const def = getReport(key);
  if (!def) notFound();
  const d = getDictionary(locale);
  const filters = parseReportFilters(await searchParams);
  const missing = (def.requires ?? []).some((k) => k === "item" && !filters.itemId);
  const [lookups, result] = await Promise.all([getReportLookups(), missing ? null : def.run(filters, locale)]);
  const qs = filtersToQuery(filters);

  return (
    <>
      <PageHeader
        title={tl(def.title, locale)}
        subtitle={tl(def.description, locale)}
        actions={
          result && (
            <>
              <LinkButton href={`/${locale}/print/reports/${def.key}?${qs}`} target="_blank">
                🖨 {d.common.print}
              </LinkButton>
              <a href={`/api/reports/${def.key}/export?${qs}&locale=${locale}&format=xlsx`} download className={buttonCls("secondary")}>
                ⬇ {d.common.exportExcel}
              </a>
              <a href={`/api/reports/${def.key}/export?${qs}&locale=${locale}&format=csv`} download className={buttonCls("ghost")}>
                {d.common.exportCsv}
              </a>
            </>
          )
        }
      />
      <Card className="mb-6">
        <ReportFilterForm filters={def.filters} values={filters} lookups={lookups} locale={locale} />
      </Card>
      {result ? (
        <Card
          bodyClassName="p-0"
          title={fmt(d.reports.rows, { n: result.rows.length })}
          subtitle={result.note ? tl(result.note, locale) : undefined}
        >
          <ReportTable result={result} locale={locale} />
        </Card>
      ) : (
        <p className="text-sm text-slate-500">{d.validation.required}: {d.reports.item}</p>
      )}
    </>
  );
}
