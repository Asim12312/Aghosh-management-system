import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { fmtDate, fmtNum, getDictionary, tl, type Locale } from "@/lib/i18n";
import { getMasterEntity, type MasterField } from "@/lib/master";
import { MasterForm } from "@/components/master-form";
import { Alert, Badge, Card, EmptyRow, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

function cell(field: MasterField, value: unknown, locale: Locale) {
  if (value === null || value === undefined || value === "") return "—";
  if (field.type === "date") return fmtDate(String(value));
  if (field.type === "number") return fmtNum(Number(value));
  if (field.type === "select") {
    const opt = field.options?.find((o) => o.value === value);
    return opt ? tl(opt.label, locale) : String(value);
  }
  return String(value);
}

export default async function MasterListPage({ params, searchParams }: PageProps<"/[locale]/master/[entity]">) {
  const user = await requireUser();
  const { locale: loc, entity: key } = await params;
  const locale = loc as Locale;
  const d = getDictionary(locale);
  const entity = getMasterEntity(key);
  if (!entity) notFound();
  const isAdmin = user.role === "admin";
  const sp = await searchParams;
  const saved = sp.saved === "1";

  const rows = await query(`SELECT * FROM ${entity.table} ORDER BY ${entity.hasActive ? "is_active DESC, " : ""}${entity.orderBy}`);
  const listFields = entity.fields.filter((f) => f.list);

  return (
    <>
      <PageHeader title={tl(entity.title, locale)} actions={isAdmin && <LinkButton href={`/${locale}/master`} variant="secondary">{d.common.back}</LinkButton>} />
      {saved && (
        <div className="mb-4">
          <Alert tone="green">{d.common.saved}</Alert>
        </div>
      )}
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Alert tone="green">{d.common.deleted}</Alert>
        </div>
      )}
      {isAdmin && (
        <Card title={`${d.common.add}: ${tl(entity.singular, locale)}`} className="mb-6">
          <MasterForm entity={entity} />
        </Card>
      )}
      <Card bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              {listFields.map((f) => (
                <Th key={f.name} numeric={f.type === "number"}>
                  {tl(f.label, locale)}
                </Th>
              ))}
              {entity.hasActive && <Th>{d.common.status}</Th>}
              {isAdmin && <Th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={listFields.length + 2}>{d.common.noRecords}</EmptyRow>}
            {rows.map((row) => (
              <tr key={String(row.id)} className={row.is_active === false ? "text-slate-400" : undefined}>
                {listFields.map((f) => (
                  <Td key={f.name} numeric={f.type === "number"} className={f.dir === "ltr" ? "ltr-nums" : undefined}>
                    {cell(f, row[f.name], locale)}
                  </Td>
                ))}
                {entity.hasActive && (
                  <Td>
                    <Badge tone={row.is_active ? "green" : "gray"}>{row.is_active ? d.common.active : d.common.inactive}</Badge>
                  </Td>
                )}
                {isAdmin && (
                  <Td className="text-end">
                    <LinkButton href={`/${locale}/master/${entity.key}/${row.id}`} variant="ghost" size="sm">
                      {d.common.edit}
                    </LinkButton>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
