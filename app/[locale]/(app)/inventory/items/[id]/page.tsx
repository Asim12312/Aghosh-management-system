import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { one, query } from "@/lib/db";
import { getCategories, getUnits, getVendors, namedOptions } from "@/lib/dal/lookups";
import { fmtDate, fmtNum, getDictionary, nm, type Locale } from "@/lib/i18n";
import { ItemForm } from "@/components/inventory-forms";
import { Badge, Card, EmptyRow, LinkButton, PageHeader, Stat, Table, Td, Th } from "@/components/ui";

export default async function ItemDetailPage({ params }: PageProps<"/[locale]/inventory/items/[id]">) {
  const user = await requireUser();
  const { locale: loc, id } = await params;
  const locale = loc as Locale;
  if (!/^\d+$/.test(id)) notFound();
  const d = getDictionary(locale);
  const t = d.inventory;

  const item = await one<Record<string, unknown> & { name_en: string; name_ur: string; code: string; unit_en: string; unit_ur: string; current_stock: number; min_stock_level: number }>(
    `SELECT i.*, u.name_en AS unit_en, u.name_ur AS unit_ur, s.current_stock
       FROM items i JOIN units u ON u.id = i.unit_id JOIN v_item_stock s ON s.item_id = i.id WHERE i.id = $1`,
    [Number(id)],
  );
  if (!item) notFound();

  const [categories, units, vendors, ledger] = await Promise.all([
    getCategories(false),
    getUnits(),
    getVendors(false),
    query<{
      id: number;
      txn_date: string;
      txn_type: "IN" | "OUT" | "ADJUST";
      signed: number;
      balance: number;
      detail_en: string | null;
      detail_ur: string | null;
      reference: string | null;
      remarks: string | null;
    }>(
      `SELECT t.id, t.txn_date, t.txn_type,
              CASE WHEN t.txn_type = 'OUT' THEN -t.quantity ELSE t.quantity END AS signed,
              SUM(CASE WHEN t.txn_type = 'OUT' THEN -t.quantity ELSE t.quantity END)
                OVER (ORDER BY t.txn_date, t.id) AS balance,
              COALESCE(fs.name_en, dp.name_en) AS detail_en, COALESCE(fs.name_ur, dp.name_ur) AS detail_ur,
              COALESCE(ds.demand_no, t.reference_no) AS reference, t.remarks
         FROM stock_transactions t
         LEFT JOIN fund_sources fs ON fs.id = t.fund_source_id
         LEFT JOIN departments dp ON dp.id = t.department_id
         LEFT JOIN demand_items di ON di.id = t.demand_item_id
         LEFT JOIN demand_sheets ds ON ds.id = di.demand_sheet_id
        WHERE t.item_id = $1 AND t.voided_at IS NULL
        ORDER BY t.txn_date DESC, t.id DESC
        LIMIT 300`,
      [Number(id)],
    ),
  ]);
  const unit = locale === "ur" ? item.unit_ur : item.unit_en;

  return (
    <>
      <PageHeader
        title={nm(item, locale)}
        subtitle={item.code}
        actions={
          <>
            <LinkButton href={`/${locale}/inventory/stock-in?item=${id}`} variant="secondary">{d.nav.stockIn}</LinkButton>
            <LinkButton href={`/${locale}/inventory/stock-out?item=${id}`} variant="secondary">{d.nav.stockOut}</LinkButton>
          </>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat
          label={t.currentStock}
          value={`${fmtNum(item.current_stock)} ${unit}`}
          tone={item.current_stock <= item.min_stock_level ? "red" : "green"}
        />
        <Stat label={t.minStock} value={`${fmtNum(item.min_stock_level)} ${unit}`} />
        <Stat label={t.leadTime} value={String(item.lead_time_days)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card title={t.ledger} className="xl:col-span-3" bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>{d.common.date}</Th>
                <Th>{t.type}</Th>
                <Th>{t.source} / {t.department}</Th>
                <Th numeric>{d.common.quantity}</Th>
                <Th numeric>{t.balance}</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && <EmptyRow colSpan={5}>{d.common.noRecords}</EmptyRow>}
              {ledger.map((r) => (
                <tr key={r.id}>
                  <Td className="ltr-nums whitespace-nowrap">{fmtDate(r.txn_date)}</Td>
                  <Td>
                    <Badge tone={r.txn_type === "IN" ? "green" : r.txn_type === "OUT" ? "blue" : "amber"}>{t[r.txn_type]}</Badge>
                  </Td>
                  <Td>
                    {(locale === "ur" ? r.detail_ur : r.detail_en) ?? r.remarks ?? "—"}
                    {r.reference && <div className="ltr-nums text-xs text-slate-400">{r.reference}</div>}
                  </Td>
                  <Td numeric className="ltr-nums">{r.signed > 0 ? "+" : ""}{fmtNum(r.signed)}</Td>
                  <Td numeric className="ltr-nums font-medium">{fmtNum(r.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title={t.editItem} className="xl:col-span-2">
          <ItemForm
            item={item}
            categories={namedOptions(categories, locale)}
            units={namedOptions(units, locale)}
            vendors={vendors.map((v) => ({ value: v.id, label: v.name }))}
            canEditThresholds={user.role === "admin"}
          />
        </Card>
      </div>
    </>
  );
}
