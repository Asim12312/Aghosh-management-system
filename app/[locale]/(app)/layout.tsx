import { requireUser } from "@/lib/dal/auth";
import { logout } from "@/lib/actions/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/[locale]">) {
  const user = await requireUser();
  return (
    <AppShell user={{ full_name: user.full_name, role: user.role }} logoutAction={logout}>
      {children}
    </AppShell>
  );
}
