"use client";

import { useState } from "react";
import { saveDemand } from "@/lib/actions/demands";
import { fmtNum } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import { ActionForm, SelectField, SubmitButton, TextField, TextareaField, type Option } from "./forms";
import { buttonCls, FormGrid, inputCls, LinkButton } from "./ui";

type Line = { key: number; item_id: string; qty_boys: string; qty_girls: string; remarks: string };
export type DemandItemOption = Option & { unit: string; stock: number };

let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, item_id: "", qty_boys: "", qty_girls: "", remarks: "" });

export function DemandForm({
  demand,
  initialLines,
  items,
  departments,
  today,
}: {
  demand?: { id: number; created_on: string; required_by: string; department_id: number | null; purpose: string | null };
  initialLines?: { item_id: number; qty_boys: number; qty_girls: number; remarks: string | null }[];
  items: DemandItemOption[];
  departments: Option[];
  today: string;
}) {
  const { locale, d } = useI18n();
  const t = d.demands;
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length
      ? initialLines.map((l) => ({
          key: nextKey++,
          item_id: String(l.item_id),
          qty_boys: l.qty_boys ? String(l.qty_boys) : "",
          qty_girls: l.qty_girls ? String(l.qty_girls) : "",
          remarks: l.remarks ?? "",
        }))
      : [blank(), blank(), blank()],
  );
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const payload = JSON.stringify(
    lines
      .filter((l) => l.item_id)
      .map((l) => ({ item_id: l.item_id, qty_boys: l.qty_boys || 0, qty_girls: l.qty_girls || 0, remarks: l.remarks || null })),
  );
  const itemById = new Map(items.map((i) => [String(i.value), i]));
  const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);

  return (
    <ActionForm action={saveDemand} className="space-y-6">
      {demand && <input type="hidden" name="id" value={demand.id} />}
      <input type="hidden" name="lines" value={payload} />
      <FormGrid cols={4}>
        <TextField name="created_on" label={t.createdOn} type="date" required defaultValue={demand?.created_on ?? today} />
        <TextField name="required_by" label={t.requiredBy} type="date" required defaultValue={demand?.required_by} min={today} />
        <SelectField name="department_id" label={t.department} options={departments} defaultValue={demand?.department_id ?? undefined} />
        <TextareaField name="purpose" label={t.purpose} defaultValue={demand?.purpose ?? undefined} rows={1} />
      </FormGrid>

      <div>
        <h3 className="mb-2 font-medium text-slate-800">{t.lines}</h3>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-2 py-2 text-start">{d.inventory.item}</th>
                <th className="w-28 px-2 py-2 text-start">{t.boys}</th>
                <th className="w-28 px-2 py-2 text-start">{t.girls}</th>
                <th className="w-24 px-2 py-2 text-end">{t.total}</th>
                <th className="w-28 px-2 py-2 text-end">{t.inStock}</th>
                <th className="px-2 py-2 text-start">{d.common.remarks}</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const item = itemById.get(l.item_id);
                const total = num(l.qty_boys) + num(l.qty_girls);
                return (
                  <tr key={l.key} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <select className={inputCls} value={l.item_id} onChange={(e) => update(l.key, { item_id: e.target.value })} aria-label={d.inventory.item}>
                        <option value="">{d.common.select}</option>
                        {items.map((i) => (
                          <option key={i.value} value={i.value}>{i.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${inputCls} ltr-nums`} inputMode="decimal" value={l.qty_boys} onChange={(e) => update(l.key, { qty_boys: e.target.value })} aria-label={t.boys} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${inputCls} ltr-nums`} inputMode="decimal" value={l.qty_girls} onChange={(e) => update(l.key, { qty_girls: e.target.value })} aria-label={t.girls} />
                    </td>
                    <td className="px-2 py-1.5 text-end font-medium tabular-nums">
                      <span className="ltr-nums">{total ? fmtNum(total) : "—"}</span> {item && total ? <span className="text-xs text-slate-400">{item.unit}</span> : null}
                    </td>
                    <td className={`px-2 py-1.5 text-end tabular-nums ${item && total > item.stock ? "text-red-600" : "text-slate-500"}`}>
                      <span className="ltr-nums">{item ? fmtNum(item.stock) : "—"}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={inputCls} value={l.remarks} onChange={(e) => update(l.key, { remarks: e.target.value })} aria-label={d.common.remarks} />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        className="rounded px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blank()]))}
                        aria-label={t.removeLine}
                        title={t.removeLine}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className={`${buttonCls("ghost", "sm")} mt-2`} onClick={() => setLines((ls) => [...ls, blank()])}>
          + {t.addLine}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="submit">{t.submit}</SubmitButton>
        <SubmitButton name="intent" value="draft" variant="secondary">{t.saveDraft}</SubmitButton>
        <LinkButton href={demand ? `/${locale}/demands/${demand.id}` : `/${locale}/demands`} variant="secondary">
          {d.common.cancel}
        </LinkButton>
      </div>
    </ActionForm>
  );
}
