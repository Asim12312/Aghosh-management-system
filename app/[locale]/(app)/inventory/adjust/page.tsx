import { requireAdmin } from "@/lib/dal/auth";
import { getTransactions } from "@/lib/dal/inventory";
import { getItemOptions, itemOptions } from "@/lib/dal/lookups";
import { getDictionary, todayISO, type Locale } from "@/lib/i18n";
import { AdjustForm } from "@/components/inventory-forms";
import { TxnTable } from "@/components/txn-table";
import { Card, PageHeader } from "@/components/ui";

export default async function AdjustPage({ params }: PageProps<"/[locale]/inventory/adjust">) {
  await requireAdmin();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const [items, recent] = await Promise.all([getItemOptions(), getTransactions({ type: "ADJUST", limit: 15, includeVoided: true })]);
  return (
    <>
      <PageHeader title={d.inventory.adjustTitle} subtitle={d.inventory.adjustSubtitle} />
      <Card className="mb-6">
        <AdjustForm items={itemOptions(items, locale)} today={todayISO()} />
      </Card>
      <Card title={d.inventory.recent} bodyClassName="p-0">
        <TxnTable rows={recent} locale={locale} canVoid show="all" />
      </Card>
    </>
  );
}
