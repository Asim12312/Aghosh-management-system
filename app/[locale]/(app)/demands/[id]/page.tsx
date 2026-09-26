import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getDemand, statusTone } from "@/lib/dal/demands";
import { fmtDate, fmtDateTime, fmtNum, getDictionary, nm, todayISO, type Locale } from "@/lib/i18n";
import { DemandStatusButtons, IssueAllButton, IssueLineForm } from "@/components/demand-actions";
import { DueBadge } from "@/components/due-badge";
import { DeleteButton } from "@/components/delete-button";
import { deleteDemand } from "@/lib/actions/delete";
import { Badge, Card, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function DemandDetailPage({ params }: PageProps<"/[locale]/demands/[id]">) {
  const user = await requireUser();
  const { locale: loc, id } = await params;
  const locale = loc as Locale;
  if (!/^\d+$/.test(id)) notFound();
  const demand = await getDemand(Number(id));
  if (!demand) notFound();
  const { header: h, lines } = demand;
  const d = getDictionary(locale);
  const t = d.demands;
  const isAdmin = user.role === "admin";
  const isOwner = h.requested_by === user.id;

  const ops: ("submit" | "approve" | "cancel")[] = [];
  if (h.status === "draft" && (isAdmin || isOwner)) ops.push("submit");
  if (h.status === "submitted" && isAdmin) ops.push("approve");
  if (!["fulfilled", "cancelled"].includes(h.status) && (isAdmin || (isOwner && h.status === "draft"))) ops.push("cancel");
  const canEdit = ["draft", "submitted"].includes(h.status) && (isAdmin || isOwner);
  const canIssue = ["approved", "partially_fulfilled"].includes(h.status);
  const canDelete = (isAdmin && ["draft", "cancelled"].includes(h.status)) || (isOwner && h.status === "draft");
  const today = todayISO();

  return (
    <>
      <PageHeader
        title={`${t.demandNo}: ${h.demand_no}`}
        subtitle={h.purpose ?? undefined}
        actions={
          <>
            {canEdit && (
              <LinkButton href={`/${locale}/demands/${h.id}/edit`} variant="secondary">
                {d.common.edit}
              </LinkButton>
            )}
            <LinkButton href={`/${locale}/print/demands/${h.id}`} variant="secondary" target="_blank">
              {t.printForm}
            </LinkButton>
            {canDelete && <DeleteButton action={deleteDemand} hidden={{ id: h.id }} />}
          </>
        }
      />

      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
          <div>
            <dt className="text-slate-500">{d.common.status}</dt>
            <dd className="mt-1">
              <Badge tone={statusTone[h.status]}>{t.statuses[h.status]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.createdOn}</dt>
            <dd className="ltr-nums mt-1 font-medium">{fmtDate(h.created_on)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.requiredBy}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium">
              <span className="ltr-nums">{fmtDate(h.required_by)}</span>
              {!["fulfilled", "cancelled"].includes(h.status) && <DueBadge daysLeft={h.days_left} d={d} />}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.department}</dt>
            <dd className="mt-1 font-medium">{(locale === "ur" ? h.dept_ur : h.dept_en) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t.requestedBy}</dt>
            <dd className="mt-1 font-medium">{h.requested_by_name}</dd>
            {h.approved_by_name && (
              <dd className="text-xs text-slate-500">
                {t.approvedBy}: {h.approved_by_name} · <span className="ltr-nums">{fmtDateTime(h.approved_at)}</span>
              </dd>
            )}
          </div>
        </dl>
        {ops.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <DemandStatusButtons id={h.id} ops={ops} />
          </div>
        )}
      </Card>

      <Card
        title={t.lines}
        subtitle={canIssue ? t.issueTitle : undefined}
        bodyClassName="p-0"
        actions={canIssue && <IssueAllButton id={h.id} today={today} />}
      >
        <Table>
          <thead>
            <tr>
              <Th>{d.inventory.item}</Th>
              <Th numeric>{t.boys}</Th>
              <Th numeric>{t.girls}</Th>
              <Th numeric>{t.total}</Th>
              <Th numeric>{t.issued}</Th>
              <Th numeric>{t.pending}</Th>
              <Th numeric>{t.inStock}</Th>
              {canIssue && <Th>{t.issue}</Th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const pending = Math.max(l.qty_total - l.qty_issued, 0);
              const unit = locale === "ur" ? l.unit_ur : l.unit_en;
              return (
                <tr key={l.id}>
                  <Td>
                    <div className="font-medium">{nm(l, locale)}</div>
                    <div className="text-xs text-slate-400">{unit}</div>
                    {l.remarks && <div className="text-xs text-slate-500">{l.remarks}</div>}
                  </Td>
                  <Td numeric className="ltr-nums">{fmtNum(l.qty_boys)}</Td>
                  <Td numeric className="ltr-nums">{fmtNum(l.qty_girls)}</Td>
                  <Td numeric className="ltr-nums font-medium">{fmtNum(l.qty_total)}</Td>
                  <Td numeric className="ltr-nums">{fmtNum(l.qty_issued)}</Td>
                  <Td numeric className={pending > 0 ? "ltr-nums font-medium text-amber-700" : "ltr-nums text-emerald-700"}>
                    {fmtNum(pending)}
                  </Td>
                  <Td numeric className={l.current_stock < pending ? "ltr-nums text-red-600" : "ltr-nums"}>{fmtNum(l.current_stock)}</Td>
                  {canIssue && (
                    <Td>{pending > 0 && l.current_stock > 0 && <IssueLineForm demandItemId={l.id} pending={Math.min(pending, l.current_stock)} today={today} />}</Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
