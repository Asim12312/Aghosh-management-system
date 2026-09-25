import Link from "next/link";
import { requireUser } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { getCategories } from "@/lib/dal/lookups";
import { fmtNum, getDictionary, nm, type Locale } from "@/lib/i18n";
import { Alert, Badge, buttonCls, Card, EmptyRow, inputCls, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function ItemsPage({ params, searchParams }: PageProps<"/[locale]/inventory/items">) {
  await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const t = d.inventory;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" && /^\d+$/.test(sp.category) ? Number(sp.category) : null;

  const [categories, items] = await Promise.all([
    getCategories(false),
    query<{
      id: number;
      code: string;
      name_en: string;
      name_ur: string;
      cat_en: string;
      cat_ur: string;
      unit_en: string;
      unit_ur: string;
      current_stock: number;
      min_stock_level: number;
      is_active: boolean;
      alert_level: string | null;
    }>(
      `SELECT i.id, i.code, i.name_en, i.name_ur, c.name_en AS cat_en, c.name_ur AS cat_ur, u.name_en AS unit_en, u.name_ur AS unit_ur,
              s.current_stock, i.min_stock_level, i.is_active, a.alert_level
         FROM items i
         JOIN item_categories c ON c.id = i.category_id
         JOIN units u ON u.id = i.unit_id
         JOIN v_item_stock s ON s.item_id = i.id
         LEFT JOIN v_stock_alerts a ON a.item_id = i.id
        WHERE ($1::text = '' OR i.name_en ILIKE '%' || $1 || '%' OR i.name_ur ILIKE '%' || $1 || '%' OR i.code ILIKE '%' || $1 || '%')
          AND ($2::int IS NULL OR i.category_id = $2)
        ORDER BY i.is_active DESC, c.name_en, i.name_en`,
      [q, category],
    ),
  ]);

  const tone = (level: string | null) => (level === "OUT_OF_STOCK" ? "red" : level === "BELOW_MIN" ? "red" : level === "RUNNING_LOW" ? "amber" : "green");

  return (
    <>
      <PageHeader
        title={t.itemsTitle}
        subtitle={t.itemsSubtitle}
        actions={<LinkButton href={`/${locale}/inventory/items/new`}>{t.newItem}</LinkButton>}
      />
      {sp.saved === "1" && (
        <div className="mb-4">
          <Alert tone="green">{d.common.saved}</Alert>
        </div>
      )}
      <Card bodyClassName="p-0">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="q">{d.common.search}</label>
            <input id="q" name="q" defaultValue={q} className={inputCls} />
          </div>
          <div className="min-w-48">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="category">{t.category}</label>
            <select id="category" name="category" defaultValue={category ?? ""} className={inputCls}>
              <option value="">{d.common.all}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{nm(c, locale)}</option>
              ))}
            </select>
          </div>
          <button className={buttonCls("secondary")}>{d.common.applyFilters}</button>
        </form>
        <Table>
          <thead>
            <tr>
              <Th>{d.common.code}</Th>
              <Th>{t.item}</Th>
              <Th>{t.category}</Th>
              <Th numeric>{t.currentStock}</Th>
              <Th numeric>{t.minStock}</Th>
              <Th>{d.common.status}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <EmptyRow colSpan={7}>{d.common.noRecords}</EmptyRow>}
            {items.map((i) => (
              <tr key={i.id} className={i.is_active ? undefined : "text-slate-400"}>
                <Td className="ltr-nums text-xs">{i.code}</Td>
                <Td>
                  <Link href={`/${locale}/inventory/items/${i.id}`} className="font-medium text-brand-700 hover:underline">
                    {nm(i, locale)}
                  </Link>
                </Td>
                <Td>{locale === "ur" ? i.cat_ur : i.cat_en}</Td>
                <Td numeric>
                  <span className="ltr-nums font-medium">{fmtNum(i.current_stock)}</span>{" "}
                  <span className="text-xs text-slate-400">{locale === "ur" ? i.unit_ur : i.unit_en}</span>
                </Td>
                <Td numeric className="ltr-nums">{fmtNum(i.min_stock_level)}</Td>
                <Td>
                  {!i.is_active ? (
                    <Badge>{d.common.inactive}</Badge>
                  ) : (
                    <Badge tone={tone(i.alert_level)}>{i.alert_level ? d.dashboard[i.alert_level as "BELOW_MIN"] : "OK"}</Badge>
                  )}
                </Td>
                <Td className="text-end">
                  <LinkButton href={`/${locale}/inventory/items/${i.id}`} variant="ghost" size="sm">
                    {t.ledger}
                  </LinkButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
