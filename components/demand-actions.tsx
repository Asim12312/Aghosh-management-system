"use client";

import { changeDemandStatus } from "@/lib/actions/demands";
import { issueAgainstDemand, issueAllForDemand } from "@/lib/actions/inventory";
import { useI18n } from "@/lib/i18n/client";
import { ActionForm, SubmitButton, useFormState } from "./forms";
import { cx, inputCls } from "./ui";

export function DemandStatusButtons({ id, ops }: { id: number; ops: ("submit" | "approve" | "cancel")[] }) {
  const { d } = useI18n();
  const t = d.demands;
  if (!ops.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {ops.map((op) => (
        <ActionForm key={op} action={changeDemandStatus} confirmMessage={op === "cancel" ? `${t.cancel}?` : undefined}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value={op} />
          <SubmitButton variant={op === "cancel" ? "danger" : "primary"}>{t[op]}</SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}

function IssueFields({ pending, today }: { pending: number; today: string }) {
  const { d } = useI18n();
  const { state } = useFormState();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        name="quantity"
        inputMode="decimal"
        defaultValue={pending}
        aria-label={d.common.quantity}
        className={cx(inputCls, "ltr-nums w-24 py-1")}
      />
      <input name="txn_date" type="date" defaultValue={today} max={today} aria-label={d.common.date} className={cx(inputCls, "w-36 py-1")} />
      <SubmitButton size="sm">{d.demands.issue}</SubmitButton>
      {state?.ok && <span className="text-xs text-emerald-700">✓</span>}
    </div>
  );
}

export function IssueLineForm({ demandItemId, pending, today }: { demandItemId: number; pending: number; today: string }) {
  return (
    <ActionForm action={issueAgainstDemand} className="[&>div.mb-4]:mb-1 [&>div.mb-4]:text-xs">
      <input type="hidden" name="demand_item_id" value={demandItemId} />
      <IssueFields pending={pending} today={today} />
    </ActionForm>
  );
}

/** One click: issue every pending line (deducting stock) and mark the demand fulfilled. */
export function IssueAllButton({ id, today }: { id: number; today: string }) {
  const { d } = useI18n();
  return (
    <ActionForm action={issueAllForDemand} className="flex flex-wrap items-center justify-end gap-2 [&>div.mb-4]:mb-0 [&>div.mb-4]:w-full">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="txn_date" value={today} />
      <SubmitButton>{d.demands.issueAll}</SubmitButton>
    </ActionForm>
  );
}
