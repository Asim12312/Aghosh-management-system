import Link from "next/link";
import { requireAdmin } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { getDictionary, tl, type Locale } from "@/lib/i18n";
import { masterEntities } from "@/lib/master";
import { PageHeader } from "@/components/ui";

export default async function MasterIndexPage({ params }: PageProps<"/[locale]/master">) {
  await requireAdmin();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const counts = await Promise.all(
    masterEntities.map(async (e) => (await query<{ n: number }>(`SELECT count(*)::int AS n FROM ${e.table}`))[0].n),
  );
  return (
    <>
      <PageHeader title={d.admin.masterTitle} subtitle={d.admin.masterSubtitle} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {masterEntities.map((e, i) => (
          <Link
            key={e.key}
            href={`/${locale}/master/${e.key}`}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-600/50"
          >
            <div className="font-medium text-slate-800">{tl(e.title, locale)}</div>
            <div className="mt-1 text-sm text-slate-500">{d.common.showing.replace("{n}", String(counts[i]))}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
