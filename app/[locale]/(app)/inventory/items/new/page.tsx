import { requireUser } from "@/lib/dal/auth";
import { getCategories, getUnits, getVendors, namedOptions } from "@/lib/dal/lookups";
import { getDictionary, type Locale } from "@/lib/i18n";
import { ItemForm } from "@/components/inventory-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function NewItemPage({ params }: PageProps<"/[locale]/inventory/items/new">) {
  const user = await requireUser();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const [categories, units, vendors] = await Promise.all([getCategories(), getUnits(), getVendors()]);
  return (
    <>
      <PageHeader title={d.inventory.newItem} />
      <Card>
        <ItemForm
          categories={namedOptions(categories, locale)}
          units={namedOptions(units, locale)}
          vendors={vendors.map((v) => ({ value: v.id, label: v.name }))}
          canEditThresholds={user.role === "admin"}
        />
      </Card>
    </>
  );
}
