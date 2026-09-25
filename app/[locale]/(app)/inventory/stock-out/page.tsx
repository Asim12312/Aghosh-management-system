import { requireUser } from "@/lib/dal/auth";
import { getOpenDemandLines, getTransactions } from "@/lib/dal/inventory";
import { getDepartments, getItemOptions, itemOptions, namedOptions } from "@/lib/dal/lookups";
import { fmtDate, fmtNum, getDictionary, nm, todayISO, type Locale } from "@/lib/i18n";
import { StockOutForm } from "@/components/inventory-forms";
import { TxnTable } from "@/components/txn-table";
import { Card, PageHeader } from "@/components/ui";

export default async function StockOutPage({ params, searchParams }: PageProps<"/[locale]/inventory/stock-out">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const [items, departments, lines, recent] = await Promise.all([
    getItemOptions(),
    getDepartments(),
    getOpenDemandLines(),
    getTransactions({ type: "OUT", limit: 15, includeVoided: true }),
  ]);
  return (
    <>
      <PageHeader title={d.inventory.stockOutTitle} subtitle={d.inventory.stockOutSubtitle} />
      <Card className="mb-6">
        <StockOutForm
          items={itemOptions(items, locale)}
          departments={namedOptions(departments, locale)}
          demandLines={lines.map((l) => ({
            value: l.demand_item_id,
            label: `${l.demand_no} · ${nm(l, locale)} · ${d.demands.pending}: ${fmtNum(l.qty_pending)} · ${fmtDate(l.required_by)}`,
          }))}
          today={todayISO()}
          defaultItem={typeof sp.item === "string" ? sp.item : undefined}
        />
      </Card>
      <Card title={d.inventory.recent} bodyClassName="p-0">
        <TxnTable rows={recent} locale={locale} canVoid={user.role === "admin"} show="out" />
      </Card>
    </>
  );
}
