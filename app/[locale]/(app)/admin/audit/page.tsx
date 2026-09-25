import { requireAdmin } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { fmtDateTime, getDictionary, type Locale } from "@/lib/i18n";
import { Card, EmptyRow, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function AuditPage({ params }: PageProps<"/[locale]/admin/audit">) {
  await requireAdmin();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const a = d.admin.audit;
  const rows = await query<{
    id: number;
    created_at: Date;
    full_name: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    details: Record<string, unknown> | null;
  }>(
    `SELECT l.id, l.created_at, u.full_name, l.action, l.entity, l.entity_id, l.details
       FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC LIMIT 300`,
  );
  return (
    <>
      <PageHeader title={d.admin.auditTitle} subtitle={d.admin.auditSubtitle} />
      <Card bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>{a.when}</Th>
              <Th>{a.user}</Th>
              <Th>{a.action}</Th>
              <Th>{a.entity}</Th>
              <Th>{a.details}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>{d.common.noRecords}</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="ltr-nums text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</Td>
                <Td>{r.full_name ?? "—"}</Td>
                <Td className="ltr-nums">{r.action}</Td>
                <Td className="ltr-nums text-xs">
                  {r.entity}
                  {r.entity_id ? ` #${r.entity_id}` : ""}
                </Td>
                <Td>
                  {r.details && (
                    <code className="ltr-nums block max-w-xl truncate text-xs text-slate-500" title={JSON.stringify(r.details)} dir="ltr">
                      {JSON.stringify(r.details)}
                    </code>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
