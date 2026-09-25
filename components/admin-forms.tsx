"use client";

import { saveSettings, saveUser } from "@/lib/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from "./forms";
import { FormGrid, LinkButton } from "./ui";

export type UserValues = {
  id: number;
  full_name: string;
  username: string;
  email: string | null;
  role: "admin" | "staff";
  preferred_locale: "en" | "ur";
  is_active: boolean;
};

export function UserForm({ user }: { user?: UserValues }) {
  const { locale, d } = useI18n();
  const a = d.admin;
  return (
    <ActionForm action={saveUser} className="space-y-5">
      {user && <input type="hidden" name="id" value={user.id} />}
      <FormGrid cols={3}>
        <TextField name="full_name" label={d.auth.fullName} required defaultValue={user?.full_name} />
        <TextField name="username" label={d.auth.username} required dir="ltr" defaultValue={user?.username} autoComplete="off" />
        <TextField name="email" label="Email" type="email" dir="ltr" defaultValue={user?.email ?? undefined} hint={d.common.optional} />
        <SelectField
          name="role"
          label={a.role}
          required
          placeholder={false}
          defaultValue={user?.role ?? "staff"}
          options={[
            { value: "staff", label: d.roles.staff },
            { value: "admin", label: d.roles.admin },
          ]}
        />
        <SelectField
          name="preferred_locale"
          label={a.preferredLocale}
          placeholder={false}
          defaultValue={user?.preferred_locale ?? "ur"}
          options={[
            { value: "ur", label: "اردو" },
            { value: "en", label: "English" },
          ]}
        />
        <TextField
          name="password"
          label={user ? a.newPassword : d.auth.password}
          type="password"
          autoComplete="new-password"
          required={!user}
          hint={user ? a.newPasswordHint : d.auth.passwordTooShort}
        />
        <CheckboxField name="is_active" label={d.common.active} defaultChecked={user ? user.is_active : true} />
      </FormGrid>
      <div className="flex gap-2">
        <SubmitButton>{d.common.save}</SubmitButton>
        <LinkButton href={`/${locale}/admin/users`} variant="secondary">
          {d.common.cancel}
        </LinkButton>
      </div>
    </ActionForm>
  );
}

export function SettingsForm({ values }: { values: Record<string, string | number> }) {
  const { d } = useI18n();
  const s = d.admin.settings;
  return (
    <ActionForm action={saveSettings} className="space-y-5">
      <FormGrid cols={3}>
        <TextField name="stock_alert_horizon_days" label={s.horizon} hint={s.horizonHint} inputMode="numeric" defaultValue={values.stock_alert_horizon_days} />
        <TextField name="consumption_window_days" label={s.window} hint={s.windowHint} inputMode="numeric" defaultValue={values.consumption_window_days} />
        <TextField name="demand_reminder_days" label={s.reminder} hint={s.reminderHint} inputMode="numeric" defaultValue={values.demand_reminder_days} />
      </FormGrid>
      <FormGrid cols={2}>
        <TextField name="org_name_en" label={s.orgEn} dir="ltr" defaultValue={values.org_name_en} />
        <TextField name="org_name_ur" label={s.orgUr} dir="rtl" defaultValue={values.org_name_ur} />
      </FormGrid>
      <SubmitButton>{d.common.save}</SubmitButton>
    </ActionForm>
  );
}
