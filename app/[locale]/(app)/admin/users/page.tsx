import { requireAdmin } from "@/lib/dal/auth";
import { query } from "@/lib/db";
import { fmtDateTime, getDictionary, type Locale } from "@/lib/i18n";
import { UserForm } from "@/components/admin-forms";
import { Alert, Badge, Card, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";

export default async function UsersPage({ params, searchParams }: PageProps<"/[locale]/admin/users">) {
  const me = await requireAdmin();
  const locale = (await params).locale as Locale;
  const sp = await searchParams;
  const d = getDictionary(locale);
  const a = d.admin;
  const users = await query<{
    id: number;
    full_name: string;
    username: string;
    role: "admin" | "staff";
    preferred_locale: string;
    is_active: boolean;
    last_login_at: Date | null;
  }>("SELECT id, full_name, username, role, preferred_locale, is_active, last_login_at FROM users ORDER BY is_active DESC, full_name");

  return (
    <>
      <PageHeader title={a.usersTitle} subtitle={a.usersSubtitle} />
      {sp.saved === "1" && (
        <div className="mb-4">
          <Alert tone="green">{d.common.saved}</Alert>
        </div>
      )}
      {sp.deleted === "1" && (
        <div className="mb-4">
          <Alert tone="green">{d.common.deleted}</Alert>
        </div>
      )}
      <Card title={a.newUser} className="mb-6">
        <UserForm />
      </Card>
      <Card bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>{d.auth.fullName}</Th>
              <Th>{d.auth.username}</Th>
              <Th>{a.role}</Th>
              <Th>{a.preferredLocale}</Th>
              <Th>{a.lastLogin}</Th>
              <Th>{d.common.status}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">
                  {u.full_name} {u.id === me.id && <span className="text-xs text-slate-400">(you)</span>}
                </Td>
                <Td className="ltr-nums">{u.username}</Td>
                <Td>
                  <Badge tone={u.role === "admin" ? "violet" : "gray"}>{d.roles[u.role]}</Badge>
                </Td>
                <Td>{u.preferred_locale === "ur" ? "اردو" : "English"}</Td>
                <Td className="ltr-nums text-xs">{fmtDateTime(u.last_login_at)}</Td>
                <Td>
                  <Badge tone={u.is_active ? "green" : "gray"}>{u.is_active ? d.common.active : d.common.inactive}</Badge>
                </Td>
                <Td className="text-end">
                  <LinkButton href={`/${locale}/admin/users/${u.id}`} variant="ghost" size="sm">
                    {d.common.edit}
                  </LinkButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
