import { requireUser } from "@/lib/dal/auth";
import { getDictionary, tl, type Locale } from "@/lib/i18n";
import { importers } from "@/lib/importers";
import { ImportCard } from "@/components/import-card";
import { PageHeader } from "@/components/ui";

export default async function ImportPage({ params }: PageProps<"/[locale]/import">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const available = importers.filter((i) => !i.adminOnly || user.role === "admin");
  return (
    <>
      <PageHeader title={d.importer.title} subtitle={d.importer.subtitle} />
      <ol className="mb-6 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        {[d.importer.step1, d.importer.step2, d.importer.step3].map((s, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        {available.map((i) => (
          <ImportCard
            key={i.key}
            type={i.key}
            title={tl(i.title, locale)}
            description={tl(i.description, locale)}
            columns={i.columns.map((c) => ({ label: tl(c.label, locale), required: Boolean(c.required) }))}
          />
        ))}
      </div>
    </>
  );
}
