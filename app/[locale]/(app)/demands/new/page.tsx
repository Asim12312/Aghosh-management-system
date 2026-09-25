import { requireUser } from "@/lib/dal/auth";
import { getDepartments, getItemOptions, namedOptions } from "@/lib/dal/lookups";
import { getDictionary, nm, todayISO, type Locale } from "@/lib/i18n";
import { DemandForm } from "@/components/demand-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewDemandPage({ params }: PageProps<"/[locale]/demands/new">) {
  await requireUser();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const [items, departments] = await Promise.all([getItemOptions(), getDepartments()]);
  return (
    <>
      <PageHeader title={d.demands.new} />
      <Card>
        <DemandForm
          items={items.map((i) => ({
            value: i.id,
            label: `${i.code} — ${nm(i, locale)}`,
            unit: locale === "ur" ? i.unit_ur : i.unit_en,
            stock: i.current_stock,
          }))}
          departments={namedOptions(departments, locale)}
          today={todayISO()}
        />
      </Card>
    </>
  );
}
