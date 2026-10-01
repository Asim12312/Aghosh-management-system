"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Car,
  ClipboardList,
  Database,
  Fuel,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Truck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { LanguageToggle } from "./language-toggle";
import { InstallAppButton } from "./pwa";
import { cx } from "./ui";
import logo from "@/public/logo.webp";

type NavItem = { href: string; label: string; icon: LucideIcon };
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

  // Close the mobile menu on navigation (state adjusted during render, as React recommends)…
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  // …and on Escape, while stopping the page scrolling behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const groups: NavGroup[] = [
    { items: [{ href: p("/dashboard"), label: d.nav.dashboard, icon: LayoutDashboard }] },
    {
      label: d.nav.inventory,
      items: [
        { href: p("/inventory/items"), label: d.nav.items, icon: Package },
        { href: p("/inventory/stock-in"), label: d.nav.stockIn, icon: ArrowDownToLine },
        { href: p("/inventory/stock-out"), label: d.nav.stockOut, icon: ArrowUpFromLine },
        ...(isAdmin ? [{ href: p("/inventory/adjust"), label: d.nav.adjust, icon: SlidersHorizontal }] : []),
        { href: p("/inventory/transactions"), label: d.nav.transactions, icon: History },
      ],
    },
    { items: [{ href: p("/demands"), label: d.nav.demands, icon: ClipboardList }] },
    {
      label: d.nav.fleet,
      items: [
        { href: p("/fleet/trips"), label: d.nav.trips, icon: Truck },
        { href: p("/fleet/fuel"), label: d.nav.fuel, icon: Fuel },
        { href: p("/master/vehicles"), label: d.nav.vehicles, icon: Car },
        { href: p("/master/drivers"), label: d.nav.drivers, icon: UserRound },
      ],
    },
    { items: [{ href: p("/reports"), label: d.nav.reports, icon: BarChart3 }] },
    ...(isAdmin
      ? [
          {
            label: d.nav.admin,
            items: [
              { href: p("/admin/users"), label: d.nav.users, icon: Users },
              { href: p("/master"), label: d.nav.masterData, icon: Database },
              { href: p("/admin/settings"), label: d.nav.settings, icon: Settings },
              { href: p("/admin/audit"), label: d.nav.audit, icon: ScrollText },
            ],
          },
        ]
      : []),
  ];

  const isActive = (href: string) =>
    pathname === href || (pathname.startsWith(href + "/") && !(href.endsWith("/master") && /\/master\/(vehicles|drivers)/.test(pathname)));

  const brand = (
    <Link href={p("/dashboard")} className="flex items-center gap-3">
      <Image src={logo} alt="" height={44} className="h-11 w-auto shrink-0 rounded-md bg-white p-0.5" priority />
      <div className="min-w-0">
        <div className="text-base leading-tight font-semibold text-white">{d.app.name}</div>
        <div className="text-[11px] leading-snug text-brand-100/70">{d.app.org}</div>
      </div>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar: an off-canvas drawer on phones/tablets, fixed full-height column on desktop. */}
      <aside
        className={cx(
          "no-print fixed inset-y-0 start-0 z-40 flex w-72 max-w-[85vw] flex-col bg-brand-900 shadow-xl transition-transform duration-200",
          "lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          !open && "max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
        )}
        aria-label={d.app.name}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          {brand}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-brand-100 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4 text-sm">
          {groups.map((g, i) => (
            <div key={i}>
              {g.label && <div className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-brand-100/60 uppercase">{g.label}</div>}
              <ul className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                          active ? "bg-white/15 font-medium text-white" : "text-brand-50/80 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Icon className={cx("size-[18px] shrink-0", active ? "text-white" : "text-brand-100/70")} aria-hidden />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
              {user.full_name.trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-white">{user.full_name}</div>
              <div className="text-xs text-brand-100/70">{d.roles[user.role]}</div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md p-2 text-brand-100 hover:bg-white/10 hover:text-white"
                title={d.common.logout}
                aria-label={d.common.logout}
              >
                <LogOut className="size-[18px] rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {open && <div className="no-print fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[1px] lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="-ms-1 rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            aria-expanded={open}
          >
            <Menu className="size-5" />
          </button>
          <Link href={p("/dashboard")} className="flex items-center gap-2 lg:hidden">
            <Image src={logo} alt="" height={32} className="h-8 w-auto" />
            <span className="font-semibold text-slate-800">{d.app.name}</span>
          </Link>
          <div className="ms-auto flex items-center gap-2">
            <InstallAppButton />
            <Suspense>
              <LanguageToggle />
            </Suspense>
            <span className="hidden text-end text-sm leading-tight sm:block lg:hidden">
              <span className="block font-medium text-slate-800">{user.full_name}</span>
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-3 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
