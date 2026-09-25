import Link from "next/link";
import { requireUser } from "@/lib/dal/auth";
import { getDictionary, tl, type Locale } from "@/lib/i18n";
import { reports } from "@/lib/reports";
import { PageHeader } from "@/components/ui";

export default async function ReportsPage({ params }: PageProps<"/[locale]/reports">) {
  await requireUser();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const groups = [
    { key: "inventory", label: d.nav.inventory },
    { key: "demands", label: d.nav.demands },
    { key: "fleet", label: d.nav.fleet },
  ] as const;
  return (
    <>
      <PageHeader title={d.reports.title} subtitle={d.reports.subtitle} />
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">{g.label}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports
                .filter((r) => r.group === g.key)
                .map((r) => (
                  <Link
                    key={r.key}
                    href={`/${locale}/reports/${r.key}`}
                    className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600/50"
                  >
                    <div className="font-medium text-slate-800 group-hover:text-brand-700">{tl(r.title, locale)}</div>
                    <p className="mt-1 text-sm text-slate-500">{tl(r.description, locale)}</p>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
