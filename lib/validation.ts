import { z } from "zod";
import type { Dictionary } from "@/lib/i18n";

export type ActionState =
  | {
      ok?: boolean;
      message?: string;
      error?: string;
      fieldErrors?: Record<string, string>;
      /** Changes on every result so client effects re-run even for identical messages. */
      at?: number;
    }
  | undefined;

const empty = (x: unknown) => (typeof x === "string" && x.trim() === "" ? undefined : x);
const toNum = (x: unknown) => {
  const v = empty(x);
  return typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** Zod building blocks for FormData, with messages in the user's language. */
export function fieldsFor(d: Dictionary) {
  const V = d.validation;
  const numError = { error: (iss: { input: unknown }) => (iss.input === undefined ? V.required : V.number) };
  return {
    str: z.preprocess(empty, z.string({ error: V.required }).trim().min(1, V.required).max(500)),
    optStr: z.preprocess(empty, z.string().trim().max(2000).optional()).transform((v) => v ?? null),
    num: z.preprocess(toNum, z.number(numError)),
    posNum: z.preprocess(toNum, z.number(numError).positive(V.positive)),
    nonNegNum: z.preprocess(toNum, z.number(numError).min(0, V.invalid)),
    optNum: z.preprocess(toNum, z.number({ error: V.number }).min(0, V.invalid).optional()).transform((v) => v ?? null),
    id: z.preprocess(toNum, z.number(numError).int().positive(V.required)),
    optId: z.preprocess(toNum, z.number({ error: V.invalid }).int().positive().optional()).transform((v) => v ?? null),
    date: z.preprocess(empty, z.string({ error: V.required }).regex(DATE_RE, V.date)),
    optDate: z.preprocess(empty, z.string().regex(DATE_RE, V.date).optional()).transform((v) => v ?? null),
    datetime: z.preprocess(empty, z.string({ error: V.required }).regex(DATETIME_RE, V.date)),
    optDatetime: z.preprocess(empty, z.string().regex(DATETIME_RE, V.date).optional()).transform((v) => v ?? null),
    bool: z.preprocess((x) => x === "on" || x === "true" || x === "1", z.boolean()),
  };
}

export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  d: Dictionary,
): { ok: true; data: z.output<S> } | { ok: false; state: ActionState } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    raw[key] = typeof value === "string" ? value : undefined;
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, state: { error: d.validation.fixErrors, fieldErrors, at: Date.now() } };
}

export const fail = (error: string, fieldErrors?: Record<string, string>): ActionState => ({
  error,
  fieldErrors,
  at: Date.now(),
});
export const success = (message: string): ActionState => ({ ok: true, message, at: Date.now() });

/** The row is still referenced by other records (Postgres foreign-key violation). */
export function isForeignKeyViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23503";
}

/** Postgres unique-violation check that works for both pg and PGlite errors. */
export function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}
