"use client";

import type { ActionState } from "@/lib/validation";
import { useI18n } from "@/lib/i18n/client";
import { ActionForm, SubmitButton } from "./forms";

/** Red "Delete" button that asks for confirmation and shows the server's refusal (e.g. record in use). */
export function DeleteButton({
  action,
  hidden,
  size = "md",
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string | number>;
  size?: "sm" | "md";
}) {
  const { d } = useI18n();
  return (
    <ActionForm action={action} confirmMessage={d.common.deleteConfirm} className="[&>div.mb-4]:mb-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant="danger" size={size}>
        {d.common.delete}
      </SubmitButton>
    </ActionForm>
  );
}
