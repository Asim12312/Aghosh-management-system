"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";
import { buttonCls } from "./ui";

/** Screen-only toolbar on print pages; opens the print dialog once the page has rendered. */
export function PrintToolbar({ autoPrint = true, backHref }: { autoPrint?: boolean; backHref?: string }) {
  const { d } = useI18n();
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 600); // let the Urdu font finish loading
    return () => clearTimeout(timer);
  }, [autoPrint]);
  return (
    <div className="no-print sticky top-0 z-10 mb-6 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
      <span className="text-sm text-slate-500">A4 · {d.common.print}</span>
      <div className="flex gap-2">
        {backHref && (
          <a href={backHref} className={buttonCls("secondary", "sm")}>
            {d.common.back}
          </a>
        )}
        <button type="button" onClick={() => window.print()} className={buttonCls("primary", "sm")}>
          🖨 {d.common.print}
        </button>
      </div>
    </div>
  );
}
