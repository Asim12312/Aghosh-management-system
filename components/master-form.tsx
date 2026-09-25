"use client";

import { saveMasterRecord } from "@/lib/actions/master";
import { tl } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import type { MasterEntity } from "@/lib/master";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from "./forms";
import { FormGrid, LinkButton } from "./ui";

export function MasterForm({
  entity,
  record,
  cancelHref,
}: {
  entity: MasterEntity;
  record?: Record<string, unknown>;
  cancelHref?: string;
}) {
  const { locale, d } = useI18n();
  const val = (name: string) => {
    const v = record?.[name];
    return v === null || v === undefined ? undefined : String(v);
  };
  return (
    <ActionForm action={saveMasterRecord} className="space-y-4" resetOnSuccess={!record}>
      <input type="hidden" name="_entity" value={entity.key} />
      {record && <input type="hidden" name="_id" value={String(record.id)} />}
      <FormGrid cols={3}>
        {entity.fields.map((field) => {
          const label = tl(field.label, locale);
          if (field.type === "select")
            return (
              <SelectField
                key={field.name}
                name={field.name}
                label={label}
                required={field.required}
                defaultValue={val(field.name)}
                options={(field.options ?? []).map((o) => ({ value: o.value, label: tl(o.label, locale) }))}
              />
            );
          if (field.type === "bool")
            return <CheckboxField key={field.name} name={field.name} label={label} defaultChecked={record?.[field.name] === true} />;
          return (
            <TextField
              key={field.name}
              name={field.name}
              label={label}
              required={field.required}
              type={field.type === "date" ? "date" : "text"}
              inputMode={field.type === "number" ? "decimal" : undefined}
              dir={field.dir}
              defaultValue={val(field.name)}
            />
          );
        })}
        {entity.hasActive && (
          <CheckboxField name="is_active" label={d.common.active} defaultChecked={record ? record.is_active === true : true} />
        )}
      </FormGrid>
      <div className="flex gap-2">
        <SubmitButton>{record ? d.common.save : d.common.add}</SubmitButton>
        {cancelHref && (
          <LinkButton href={cancelHref} variant="secondary">
            {d.common.cancel}
          </LinkButton>
        )}
      </div>
    </ActionForm>
  );
}
