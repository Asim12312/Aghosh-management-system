import { requireAdmin } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { getDictionary, type Locale } from "@/lib/i18n";
import { SettingsForm } from "@/components/admin-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function SettingsPage({ params }: PageProps<"/[locale]/admin/settings">) {
  await requireAdmin();
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  const rows = await query<{ key: string; value: string | number }>("SELECT key, value FROM app_settings");
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return (
    <>
      <PageHeader title={d.admin.settingsTitle} subtitle={d.admin.settingsSubtitle} />
      <Card>
        <SettingsForm values={values} />
      </Card>
    </>
  );
}
