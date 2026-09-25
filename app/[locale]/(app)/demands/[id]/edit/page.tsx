import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/dal/auth";
import { getDemand } from "@/lib/dal/demands";
import { getDepartments, getItemOptions, namedOptions } from "@/lib/dal/lookups";
import { getDictionary, nm, todayISO, type Locale } from "@/lib/i18n";
import { DemandForm } from "@/components/demand-form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditDemandPage({ params }: PageProps<"/[locale]/demands/[id]/edit">) {
  const user = await requireUser();
  const { locale: loc, id } = await params;
  const locale = loc as Locale;
  if (!/^\d+$/.test(id)) notFound();
  const demand = await getDemand(Number(id));
  if (!demand) notFound();
  const { header, lines } = demand;
  const canEdit =
    ["draft", "submitted"].includes(header.status) && (user.role === "admin" || header.requested_by === user.id);
  if (!canEdit) redirect(`/${locale}/demands/${id}`);
  const d = getDictionary(locale);
  const [items, departments] = await Promise.all([getItemOptions(false), getDepartments()]);
  return (
    <>
      <PageHeader title={`${d.common.edit}: ${header.demand_no}`} />
      <Card>
        <DemandForm
          demand={header}
          initialLines={lines}
          items={items.map((i) => ({
            value: i.id,
            label: `${i.code} — ${nm(i, locale)}`,
            unit: locale === "ur" ? i.unit_ur : i.unit_en,
            stock: i.current_stock,
          }))}
          departments={namedOptions(departments, locale)}
          today={todayISO() < header.created_on ? todayISO() : header.created_on}
        />
      </Card>
    </>
  );
}
