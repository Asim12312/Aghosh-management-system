import { requireUser } from "@/lib/dal/auth";
import { getTransactions } from "@/lib/dal/inventory";
import { getItemOptions } from "@/lib/dal/lookups";
import { fmt, getDictionary, nm, type Locale } from "@/lib/i18n";
import { TxnTable } from "@/components/txn-table";
import { buttonCls, Card, inputCls, PageHeader } from "@/components/ui";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TransactionsPage({ params, searchParams }: PageProps<"/[locale]/inventory/transactions">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const t = d.inventory;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const filters = {
    type: str("type"),
    itemId: /^\d+$/.test(str("item")) ? Number(str("item")) : undefined,
    from: DATE_RE.test(str("from")) ? str("from") : undefined,
    to: DATE_RE.test(str("to")) ? str("to") : undefined,
    includeVoided: str("voided") === "1",
  };
  const [items, rows] = await Promise.all([getItemOptions(false), getTransactions(filters)]);
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <>
      <PageHeader title={t.transactionsTitle} subtitle={t.transactionsSubtitle} />
      <Card bodyClassName="p-0">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div>
            <label className={label} htmlFor="type">{t.type}</label>
            <select id="type" name="type" defaultValue={filters.type} className={inputCls}>
              <option value="">{d.common.all}</option>
              <option value="IN">{t.IN}</option>
              <option value="OUT">{t.OUT}</option>
              <option value="ADJUST">{t.ADJUST}</option>
            </select>
          </div>
          <div className="min-w-56">
            <label className={label} htmlFor="item">{t.item}</label>
            <select id="item" name="item" defaultValue={filters.itemId ?? ""} className={inputCls}>
              <option value="">{d.common.all}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{nm(i, locale)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="from">{d.common.from}</label>
            <input id="from" type="date" name="from" defaultValue={filters.from} className={inputCls} />
          </div>
          <div>
            <label className={label} htmlFor="to">{d.common.to}</label>
            <input id="to" type="date" name="to" defaultValue={filters.to} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="voided" value="1" defaultChecked={filters.includeVoided} className="accent-brand-700" />
            {t.voided}
          </label>
          <button className={buttonCls("secondary")}>{d.common.applyFilters}</button>
          <span className="pb-2 text-xs text-slate-500">{fmt(d.common.showing, { n: rows.length })}</span>
        </form>
        <TxnTable rows={rows} locale={locale} canVoid={user.role === "admin"} />
      </Card>
    </>
  );
}
