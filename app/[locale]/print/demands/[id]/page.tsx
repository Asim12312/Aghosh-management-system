import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getDemand } from "@/lib/dal/demands";
import { getSetting } from "@/lib/dal/lookups";
import { fmtDate, fmtNum, getDictionary, nm, type Locale } from "@/lib/i18n";
import { PrintDocument } from "@/components/print-layout";
import { Table, Td, Th } from "@/components/ui";

export default async function PrintDemandPage({ params }: PageProps<"/[locale]/print/demands/[id]">) {
  const user = await requireUser();
  const { locale: loc, id } = await params;
  const locale = loc as Locale;
  if (!/^\d+$/.test(id)) notFound();
  const demand = await getDemand(Number(id));
  if (!demand) notFound();
  const { header: h, lines } = demand;
  const d = getDictionary(locale);
  const t = d.demands;
  const orgName = await getSetting<string>(locale === "ur" ? "org_name_ur" : "org_name_en", d.app.org);

  return (
    <PrintDocument
      locale={locale}
      orgName={orgName}
      title={`${t.title} — ${h.demand_no}`}
      meta={[
        { label: t.createdOn, value: fmtDate(h.created_on) },
        { label: t.requiredBy, value: fmtDate(h.required_by) },
        { label: t.department, value: (locale === "ur" ? h.dept_ur : h.dept_en) ?? "—" },
        { label: d.common.status, value: t.statuses[h.status] },
        { label: t.requestedBy, value: h.requested_by_name },
        ...(h.approved_by_name ? [{ label: t.approvedBy, value: h.approved_by_name }] : []),
        ...(h.purpose ? [{ label: t.purpose, value: h.purpose }] : []),
      ]}
      generatedBy={user.full_name}
      backHref={`/${locale}/demands/${h.id}`}
    >
      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>{d.inventory.item}</Th>
            <Th>{d.inventory.unit}</Th>
            <Th numeric>{t.boys}</Th>
            <Th numeric>{t.girls}</Th>
            <Th numeric>{t.total}</Th>
            <Th numeric>{t.issued}</Th>
            <Th numeric>{t.pending}</Th>
            <Th>{d.common.remarks}</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id}>
              <Td className="ltr-nums">{i + 1}</Td>
              <Td>
                {nm(l, locale)} <span className="ltr-nums text-xs text-slate-500">({l.code})</span>
              </Td>
              <Td>{locale === "ur" ? l.unit_ur : l.unit_en}</Td>
              <Td numeric className="ltr-nums">{fmtNum(l.qty_boys)}</Td>
              <Td numeric className="ltr-nums">{fmtNum(l.qty_girls)}</Td>
              <Td numeric className="ltr-nums font-semibold">{fmtNum(l.qty_total)}</Td>
              <Td numeric className="ltr-nums">{fmtNum(l.qty_issued)}</Td>
              <Td numeric className="ltr-nums">{fmtNum(Math.max(l.qty_total - l.qty_issued, 0))}</Td>
              <Td className="text-xs">{l.remarks ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </PrintDocument>
  );
}
