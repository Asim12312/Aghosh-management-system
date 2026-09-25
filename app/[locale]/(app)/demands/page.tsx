import Link from "next/link";
import { requireUser } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { getDepartments } from "@/lib/dal/lookups";
import { statusTone, type DemandStatus } from "@/lib/dal/demands";
import { fmtDate, fmtNum, getDictionary, nm, type Locale } from "@/lib/i18n";
import { DueBadge } from "@/components/due-badge";
import { Badge, buttonCls, Card, EmptyRow, inputCls, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

const STATUSES: DemandStatus[] = ["draft", "submitted", "approved", "partially_fulfilled", "fulfilled", "cancelled"];

export default async function DemandsPage({ params, searchParams }: PageProps<"/[locale]/demands">) {
  await requireUser();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const t = d.demands;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status as DemandStatus) ? sp.status : "";
  const open = sp.status === undefined || sp.status === "open";
  const dept = typeof sp.department === "string" && /^\d+$/.test(sp.department) ? Number(sp.department) : null;

  const [departments, rows] = await Promise.all([
    getDepartments(false),
    query<{
      id: number;
      demand_no: string;
      created_on: string;
      required_by: string;
      status: DemandStatus;
      dept_en: string | null;
      dept_ur: string | null;
      requested_by_name: string;
      lines: number;
      qty_total: number;
      qty_issued: number;
      days_left: number;
    }>(
      `SELECT ds.id, ds.demand_no, ds.created_on, ds.required_by, ds.status, dp.name_en AS dept_en, dp.name_ur AS dept_ur,
              u.full_name AS requested_by_name, (ds.required_by - current_date) AS days_left,
              COUNT(p.id)::int AS lines, COALESCE(SUM(p.qty_total), 0) AS qty_total, COALESCE(SUM(LEAST(p.qty_issued, p.qty_total)), 0) AS qty_issued
         FROM demand_sheets ds
         JOIN users u ON u.id = ds.requested_by
         LEFT JOIN departments dp ON dp.id = ds.department_id
         LEFT JOIN v_demand_item_progress p ON p.demand_sheet_id = ds.id
        WHERE ($1::text = '' OR ds.status = $1::text::demand_status)
          AND (NOT $2::boolean OR ds.status NOT IN ('fulfilled', 'cancelled'))
          AND ($3::int IS NULL OR ds.department_id = $3)
        GROUP BY ds.id, dp.name_en, dp.name_ur, u.full_name
        ORDER BY ds.required_by DESC, ds.id DESC
        LIMIT 300`,
      [status, open && !status, dept],
    ),
  ]);
  const label = "mb-1 block text-sm font-medium text-slate-700";

  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} actions={<LinkButton href={`/${locale}/demands/new`}>{t.new}</LinkButton>} />
      <Card bodyClassName="p-0">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
          <div>
            <label className={label} htmlFor="status">{d.common.status}</label>
            <select id="status" name="status" defaultValue={status || (open ? "open" : "all")} className={inputCls}>
              <option value="open">{d.dashboard.pending}</option>
              <option value="all">{d.common.all}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t.statuses[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="department">{t.department}</label>
            <select id="department" name="department" defaultValue={dept ?? ""} className={inputCls}>
              <option value="">{d.common.all}</option>
              {departments.map((x) => (
                <option key={x.id} value={x.id}>{nm(x, locale)}</option>
              ))}
            </select>
          </div>
          <button className={buttonCls("secondary")}>{d.common.applyFilters}</button>
        </form>
        <Table>
          <thead>
            <tr>
              <Th>{t.demandNo}</Th>
              <Th>{t.createdOn}</Th>
              <Th>{t.requiredBy}</Th>
              <Th>{t.department}</Th>
              <Th numeric>{t.lines}</Th>
              <Th numeric>{t.issued} / {t.total}</Th>
              <Th>{d.common.status}</Th>
              <Th>{t.requestedBy}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={8}>{d.common.noRecords}</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <Td>
                  <Link href={`/${locale}/demands/${r.id}`} className="ltr-nums font-medium text-brand-700 hover:underline">
                    {r.demand_no}
                  </Link>
                </Td>
                <Td className="ltr-nums">{fmtDate(r.created_on)}</Td>
                <Td>
                  <div className="ltr-nums">{fmtDate(r.required_by)}</div>
                  {!["fulfilled", "cancelled", "draft"].includes(r.status) && <DueBadge daysLeft={r.days_left} d={d} />}
                </Td>
                <Td>{(locale === "ur" ? r.dept_ur : r.dept_en) ?? "—"}</Td>
                <Td numeric>{r.lines}</Td>
                <Td numeric className="ltr-nums">{fmtNum(r.qty_issued)} / {fmtNum(r.qty_total)}</Td>
                <Td>
                  <Badge tone={statusTone[r.status]}>{t.statuses[r.status]}</Badge>
                </Td>
                <Td className="text-xs text-slate-500">{r.requested_by_name}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
