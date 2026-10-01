"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { fmt } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { buttonCls, cx } from "./ui";

type Result =
  | { ok: true; created: number; updated: number; rows: number }
  | { ok: false; error?: string; errors: { row: number; column: string; message: string }[] };

export function ImportCard({
  type,
  title,
  description,
  columns,
}: {
  type: string;
  title: string;
  description: string;
  columns: { label: string; required: boolean }[];
}) {
  const { locale, d } = useI18n();
  const t = d.importer;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setResult({ ok: false, error: t.chooseFile, errors: [] });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("locale", locale);
      const res = await fetch(`/api/import/${type}`, { method: "POST", body: form });
      setResult((await res.json()) as Result);
      if (res.ok && fileRef.current) {
        fileRef.current.value = "";
        setFileName("");
      }
    } catch {
      setResult({ ok: false, error: d.common.unexpectedError, errors: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <FileSpreadsheet className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <p className="text-xs leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">{t.columns}: </span>
          {columns.map((c, i) => (
            <span key={c.label}>
              {i > 0 && " · "}
              {c.label}
              {c.required && <span className="text-red-600">*</span>}
            </span>
          ))}
        </p>

        <a href={`/api/import/${type}/template?locale=${locale}`} download className={cx(buttonCls("ghost", "sm"), "self-start")}>
          <Download className="size-4" aria-hidden /> {t.template}
        </a>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-600 hover:border-brand-600 hover:bg-brand-50/40">
          <Upload className="size-5 shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{fileName || t.chooseFile}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              setFileName(e.target.files?.[0]?.name ?? "");
              setResult(null);
            }}
          />
        </label>

        <button type="button" onClick={upload} disabled={busy} className={cx(buttonCls("primary"), "self-start")}>
          {busy ? t.importing : t.import}
        </button>

        {result?.ok && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {fmt(t.done, { rows: result.rows, created: result.created, updated: result.updated })}
          </div>
        )}
        {result && !result.ok && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <div className="flex items-start gap-2 font-medium">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {result.error}
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-semibold">
                      {t.row} <span className="ltr-nums">{e.row}</span> · {e.column}:
                    </span>{" "}
                    {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
