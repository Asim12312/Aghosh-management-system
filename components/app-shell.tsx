"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { LanguageToggle } from "./language-toggle";
import { InstallAppButton } from "./pwa";
import { cx } from "./ui";
import logo from "@/public/logo.webp";

type NavItem = { href: string; label: string };
type NavGroup = { label?: string; items: NavItem[] };

export function AppShell({
  user,
  logoutAction,
  children,
}: {
  user: { full_name: string; role: "admin" | "staff" };
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const { locale, d } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const p = (path: string) => `/${locale}${path}`;
  const isAdmin = user.role === "admin";

  const groups: NavGroup[] = [
    { items: [{ href: p("/dashboard"), label: d.nav.dashboard }] },
    {
      label: d.nav.inventory,
      items: [
        { href: p("/inventory/items"), label: d.nav.items },
        { href: p("/inventory/stock-in"), label: d.nav.stockIn },
        { href: p("/inventory/stock-out"), label: d.nav.stockOut },
        ...(isAdmin ? [{ href: p("/inventory/adjust"), label: d.nav.adjust }] : []),
        { href: p("/inventory/transactions"), label: d.nav.transactions },
      ],
    },
    { items: [{ href: p("/demands"), label: d.nav.demands }] },
    {
      label: d.nav.fleet,
      items: [
        { href: p("/fleet/trips"), label: d.nav.trips },
        { href: p("/fleet/fuel"), label: d.nav.fuel },
        { href: p("/master/vehicles"), label: d.nav.vehicles },
        { href: p("/master/drivers"), label: d.nav.drivers },
      ],
    },
    { items: [{ href: p("/reports"), label: d.nav.reports }] },
    ...(isAdmin
      ? [
          {
            label: d.nav.admin,
            items: [
              { href: p("/admin/users"), label: d.nav.users },
              { href: p("/master"), label: d.nav.masterData },
              { href: p("/admin/settings"), label: d.nav.settings },
              { href: p("/admin/audit"), label: d.nav.audit },
            ],
          },
        ]
      : []),
  ];

  const isActive = (href: string) =>
    pathname === href || (pathname.startsWith(href + "/") && !(href.endsWith("/master") && /\/master\/(vehicles|drivers)/.test(pathname)));

  const nav = (
    <nav className="space-y-5 px-3 py-4 text-sm">
      {groups.map((g, i) => (
        <div key={i}>
          {g.label && <div className="mb-1 px-2 text-xs font-semibold tracking-wide text-brand-100/70 uppercase">{g.label}</div>}
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "block rounded-md px-2 py-1.5 transition-colors",
                    isActive(item.href) ? "bg-white/15 font-medium text-white" : "text-brand-50/85 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={cx(
          "no-print fixed inset-y-0 start-0 z-40 w-64 shrink-0 overflow-y-auto bg-brand-900 transition-transform lg:static",
          !open && "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
        )}
      >
        <Link href={p("/dashboard")} className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <Image src={logo} alt="" height={48} className="h-12 w-auto shrink-0 rounded-md bg-white p-0.5" priority />
          <div className="min-w-0">
            <div className="text-base font-semibold text-white">{d.app.name}</div>
            <div className="text-xs leading-snug text-brand-100/70">{d.app.org}</div>
          </div>
        </Link>
        {nav}
      </aside>
      {open && <div className="no-print fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-slate-700 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="text-end text-sm leading-tight">
              <div className="font-medium text-slate-800">{user.full_name}</div>
              <div className="text-xs text-slate-500">{d.roles[user.role]}</div>
            </div>
            <InstallAppButton />
            <Suspense>
              <LanguageToggle />
            </Suspense>
            <form action={logoutAction}>
              <button className="rounded-md px-3 py-1 text-sm text-slate-600 hover:bg-slate-100" type="submit">
                {d.common.logout}
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
