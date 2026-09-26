import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal/auth";
import { one } from "@/lib/db";
import { getDictionary, type Locale } from "@/lib/i18n";
import { UserForm, type UserValues } from "@/components/admin-forms";
import { DeleteButton } from "@/components/delete-button";
import { deleteUser } from "@/lib/actions/delete";
import { Card, PageHeader } from "@/components/ui";

export default async function EditUserPage({ params }: PageProps<"/[locale]/admin/users/[id]">) {
  const me = await requireAdmin();
  const { locale: loc, id } = await params;
  const locale = loc as Locale;
  if (!/^\d+$/.test(id)) notFound();
  const user = await one<UserValues>(
    "SELECT id, full_name, username, email, role, preferred_locale, is_active FROM users WHERE id = $1",
    [Number(id)],
  );
  if (!user) notFound();
  const d = getDictionary(locale);
  return (
    <>
      <PageHeader
        title={`${d.common.edit}: ${user.full_name}`}
        actions={user.id !== me.id && <DeleteButton action={deleteUser} hidden={{ id: user.id }} />}
      />
      <Card>
        <UserForm user={user} />
      </Card>
    </>
  );
}
