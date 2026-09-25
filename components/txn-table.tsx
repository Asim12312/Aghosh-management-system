import { voidTransaction } from "@/lib/actions/inventory";
import type { TxnRow } from "@/lib/dal/inventory";
import { fmtDate, fmtMoney, fmtNum, getDictionary, type Locale } from "@/lib/i18n";
import { InlineActionForm } from "./forms";
import { Badge, EmptyRow, Table, Td, Th } from "./ui";

const typeTone = { IN: "green", OUT: "blue", ADJUST: "amber" } as const;

/** Stock entries table used by the receive, issue and transactions screens. */
export function TxnTable({
  rows,
  locale,
  canVoid,
  show = "all",
}: {
  rows: TxnRow[];
  locale: Locale;
  canVoid: boolean;
  show?: "all" | "in" | "out";
}) {
  const d = getDictionary(locale);
  const t = d.inventory;
  const ur = locale === "ur";
  const cols = 7 + (canVoid ? 1 : 0);
  return (
    <Table>
      <thead>
        <tr>
          <Th>{d.common.date}</Th>
          {show === "all" && <Th>{t.type}</Th>}
          <Th>{t.item}</Th>
          <Th numeric>{d.common.quantity}</Th>
          {show !== "out" && <Th>{t.source}</Th>}
          {show !== "in" && <Th>{t.department}</Th>}
          <Th>{t.reference}</Th>
          <Th>{t.enteredBy}</Th>
          {canVoid && <Th />}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={cols}>{d.common.noRecords}</EmptyRow>}
        {rows.map((r) => {
          const signed = r.txn_type === "OUT" ? -r.quantity : r.quantity;
          return (
            <tr key={r.id} className={r.voided_at ? "text-slate-400 line-through decoration-slate-300" : undefined}>
              <Td className="ltr-nums whitespace-nowrap">{fmtDate(r.txn_date)}</Td>
              {show === "all" && (
                <Td>
                  <Badge tone={r.voided_at ? "gray" : typeTone[r.txn_type]}>{r.voided_at ? t.voided : t[r.txn_type]}</Badge>
                </Td>
              )}
              <Td>
                <div className="font-medium text-slate-800">{ur ? r.item_ur : r.item_en}</div>
                <div className="ltr-nums text-xs text-slate-400">{r.item_code}</div>
                {r.remarks && <div className="text-xs text-slate-500">{r.remarks}</div>}
                {r.voided_at && r.void_reason && <div className="text-xs text-red-600 no-underline">{r.void_reason}</div>}
              </Td>
              <Td numeric className="whitespace-nowrap">
                <span className="ltr-nums">{show === "all" && signed > 0 ? "+" : ""}{fmtNum(show === "all" ? signed : r.quantity)}</span>{" "}
                <span className="text-xs text-slate-400">{ur ? r.unit_ur : r.unit_en}</span>
              </Td>
              {show !== "out" && (
                <Td>
                  {(ur ? r.source_ur : r.source_en) ?? "—"}
                  {(r.vendor || r.donor_name) && <div className="text-xs text-slate-500">{[r.vendor, r.donor_name].filter(Boolean).join(" · ")}</div>}
                  {r.unit_cost !== null && <div className="ltr-nums text-xs text-slate-400">Rs {fmtMoney(r.unit_cost)}</div>}
                </Td>
              )}
              {show !== "in" && (
                <Td>
                  {(ur ? r.dept_ur : r.dept_en) ?? "—"}
                  {r.issued_to && <div className="text-xs text-slate-500">{r.issued_to}</div>}
                </Td>
              )}
              <Td className="ltr-nums text-xs">{r.demand_no ?? r.reference_no ?? "—"}</Td>
              <Td className="text-xs text-slate-500">{r.created_by_name}</Td>
              {canVoid && (
                <Td className="text-end">
                  {!r.voided_at && (
                    <InlineActionForm
                      action={voidTransaction}
                      hidden={{ id: r.id }}
                      buttonLabel={t.void}
                      fieldName="void_reason"
                      fieldLabel={t.voidReason}
                      submitLabel={t.void}
                    />
                  )}
                </Td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
