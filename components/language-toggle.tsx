"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

/** Switches between English and Urdu while staying on the same page. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const other = locale === "en" ? "ur" : "en";
  const href = pathname.replace(/^\/(en|ur)(?=\/|$)/, `/${other}`) + (search ? `?${search}` : "");
  return (
    <Link
      href={href}
      lang={other}
      className={
        className ??
        "rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
      }
    >
      {other === "ur" ? "اردو" : "English"}
    </Link>
  );
}
