import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal/auth";
import { one } from "@/lib/db";
import { getDictionary, tl, type Locale } from "@/lib/i18n";
import { getMasterEntity } from "@/lib/master";
import { MasterForm } from "@/components/master-form";
import { Card, PageHeader } from "@/components/ui";

export default async function MasterEditPage({ params }: PageProps<"/[locale]/master/[entity]/[id]">) {
  await requireAdmin();
  const { locale: loc, entity: key, id } = await params;
  const locale = loc as Locale;
  const d = getDictionary(locale);
  const entity = getMasterEntity(key);
  if (!entity || !/^\d+$/.test(id)) notFound();
  const record = await one(`SELECT * FROM ${entity.table} WHERE id = $1`, [Number(id)]);
  if (!record) notFound();
  return (
    <>
      <PageHeader title={`${d.common.edit}: ${tl(entity.singular, locale)}`} />
      <Card>
        <MasterForm entity={entity} record={record} cancelHref={`/${locale}/master/${entity.key}`} />
      </Card>
    </>
  );
}
