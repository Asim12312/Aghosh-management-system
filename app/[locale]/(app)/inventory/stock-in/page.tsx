import { requireUser } from "@/lib/dal/auth";
import { getTransactions } from "@/lib/dal/inventory";
import { getFundSources, getItemOptions, getVendors, itemOptions, namedOptions } from "@/lib/dal/lookups";
import { getDictionary, todayISO, type Locale } from "@/lib/i18n";
import { StockInForm } from "@/components/inventory-forms";
import { TxnTable } from "@/components/txn-table";
import { Card, PageHeader } from "@/components/ui";

export default async function StockInPage({ params, searchParams }: PageProps<"/[locale]/inventory/stock-in">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const [items, sources, vendors, recent] = await Promise.all([
    getItemOptions(),
    getFundSources(),
    getVendors(),
    getTransactions({ type: "IN", limit: 15, includeVoided: true }),
  ]);
  return (
    <>
      <PageHeader title={d.inventory.stockInTitle} subtitle={d.inventory.stockInSubtitle} />
      <Card className="mb-6">
        <StockInForm
          items={itemOptions(items, locale)}
          sources={namedOptions(sources, locale)}
          vendors={vendors.map((v) => ({ value: v.id, label: v.name }))}
          today={todayISO()}
          defaultItem={typeof sp.item === "string" ? sp.item : undefined}
        />
      </Card>
      <Card title={d.inventory.recent} bodyClassName="p-0">
        <TxnTable rows={recent} locale={locale} canVoid={user.role === "admin"} show="in" />
      </Card>
    </>
  );
}
