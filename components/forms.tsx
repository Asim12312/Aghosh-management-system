"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/validation";
import { useI18n } from "@/lib/i18n/client";
import { Alert, buttonCls, cx, inputCls, type ButtonVariant } from "./ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const FormCtx = createContext<{ state: ActionState; pending: boolean }>({ state: undefined, pending: false });

/**
 * Form wired to a Server Action through useActionState. Submits via onSubmit so React does not
 * clear the fields when the server returns validation errors.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirmMessage,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const fd = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        startTransition(() => formAction(fd));
      }}
    >
      <FormCtx.Provider value={{ state, pending }}>
        {state?.error && (
          <div className="mb-4">
            <Alert>{state.error}</Alert>
          </div>
        )}
        {state?.ok && state.message && (
          <div className="mb-4">
            <Alert tone="green">{state.message}</Alert>
          </div>
        )}
        {children}
      </FormCtx.Provider>
    </form>
  );
}

export function useFormState() {
  return useContext(FormCtx);
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  name,
  value,
  className,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormState();
  const { d } = useI18n();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cx(buttonCls(variant, size), className)}>
      {pending ? d.common.working : children}
    </button>
  );
}

function FieldShell({
  name,
  label,
  hint,
  required,
  children,
  className,
}: {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { state } = useFormState();
  const error = state?.fieldErrors?.[name];
  return (
    <div className={className}>
      {label && (
        <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ms-0.5 text-red-600">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> & {
  name: string;
  label?: string;
  hint?: string;
  wrapperClassName?: string;
};

export function TextField({ name, label, hint, required, wrapperClassName, className, ...rest }: InputProps) {
  const { state } = useFormState();
  const numeric = rest.type === "number" || rest.inputMode === "decimal";
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} className={wrapperClassName}>
      <input
        id={`f-${name}`}
        name={name}
        aria-invalid={Boolean(state?.fieldErrors?.[name]) || undefined}
        className={cx(inputCls, numeric && "ltr-nums text-start", className)}
        {...rest}
      />
    </FieldShell>
  );
}

export type Option = { value: string | number; label: string };

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name"> & {
  name: string;
  label?: string;
  hint?: string;
  options: Option[];
  placeholder?: string | false;
  wrapperClassName?: string;
};

export function SelectField({
  name,
  label,
  hint,
  required,
  options,
  placeholder,
  wrapperClassName,
  className,
  ...rest
}: SelectProps) {
  const { state } = useFormState();
  const { d } = useI18n();
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} className={wrapperClassName}>
      <select
        id={`f-${name}`}
        name={name}
        aria-invalid={Boolean(state?.fieldErrors?.[name]) || undefined}
        className={cx(inputCls, className)}
        {...rest}
      >
        {placeholder !== false && <option value="">{placeholder ?? d.common.select}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name"> & {
  name: string;
  label?: string;
  hint?: string;
  wrapperClassName?: string;
};

export function TextareaField({ name, label, hint, required, wrapperClassName, className, ...rest }: TextareaProps) {
  const { state } = useFormState();
  return (
    <FieldShell name={name} label={label} hint={hint} required={required} className={wrapperClassName}>
      <textarea
        id={`f-${name}`}
        name={name}
        rows={2}
        aria-invalid={Boolean(state?.fieldErrors?.[name]) || undefined}
        className={cx(inputCls, className)}
        {...rest}
      />
    </FieldShell>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  wrapperClassName,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  wrapperClassName?: string;
}) {
  return (
    <label className={cx("flex items-center gap-2 pt-6 text-sm text-slate-700", wrapperClassName)}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 rounded border-slate-300 accent-brand-700" />
      {label}
    </label>
  );
}

/** A small button that expands into a one-field form (e.g. "Void" with a reason). */
export function InlineActionForm({
  action,
  hidden,
  buttonLabel,
  fieldName,
  fieldLabel,
  submitLabel,
  variant = "danger",
}: {
  action: Action;
  hidden: Record<string, string | number>;
  buttonLabel: string;
  fieldName: string;
  fieldLabel: string;
  submitLabel: string;
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={buttonCls("secondary", "sm")} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex min-w-56 flex-col gap-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <TextField name={fieldName} placeholder={fieldLabel} aria-label={fieldLabel} autoFocus />
      <div className="flex gap-2">
        <SubmitButton variant={variant} size="sm">
          {submitLabel}
        </SubmitButton>
        <button type="button" className={buttonCls("secondary", "sm")} onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    </ActionForm>
  );
}
