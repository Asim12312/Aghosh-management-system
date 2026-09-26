import Image from "next/image";
import { fmtDateTime, getDictionary, type Locale } from "@/lib/i18n";
import logo from "@/public/aghosh-logo.jpg";
import { PrintToolbar } from "./print-toolbar";

/** A4 document frame shared by every printable page: letterhead, filters, body and signature block. */
export function PrintDocument({
  locale,
  orgName,
  title,
  meta,
  generatedBy,
  landscape = false,
  backHref,
  children,
}: {
  locale: Locale;
  orgName: string;
  title: string;
  meta: { label: string; value: string }[];
  generatedBy: string;
  landscape?: boolean;
  backHref?: string;
  children: React.ReactNode;
}) {
  const d = getDictionary(locale);
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {landscape && <style>{`@page { size: A4 landscape; }`}</style>}
      <PrintToolbar backHref={backHref} />
      <article
        className={`mx-auto bg-white px-8 py-8 shadow-sm print:mx-0 print:w-auto print:p-0 print:shadow-none ${landscape ? "max-w-[297mm]" : "max-w-[210mm]"}`}
      >
        <header className="mb-4 flex items-center gap-4 border-b-2 border-slate-800 pb-3">
          <Image src={logo} alt="Aghosh" height={72} className="h-[72px] w-auto shrink-0" priority />
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-slate-900">{orgName}</div>
            <div className="text-xs text-slate-600">{d.app.tagline}</div>
            <h1 className="mt-2 text-xl font-semibold">{title}</h1>
          </div>
          {/* Balances the logo so the titles stay centred on the page. */}
          <div className="w-[60px] shrink-0" aria-hidden />
        </header>
        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3 print:grid-cols-3">
          {meta.map((m) => (
            <div key={m.label} className="flex gap-1">
              <dt className="font-semibold text-slate-600">{m.label}:</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
          <div className="flex gap-1">
            <dt className="font-semibold text-slate-600">{d.common.generatedOn}:</dt>
            <dd className="ltr-nums">{fmtDateTime(new Date())}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold text-slate-600">{d.common.generatedBy}:</dt>
            <dd>{generatedBy}</dd>
          </div>
        </dl>

        {children}

        <footer className="avoid-break mt-14 grid grid-cols-3 gap-8 text-center text-xs">
          {[d.common.preparedBy, d.common.checkedBy, d.common.approvedBy].map((label) => (
            <div key={label}>
              <div className="mb-1 h-8 border-b border-slate-500" />
              {label}
            </div>
          ))}
        </footer>
      </article>
    </div>
  );
}
