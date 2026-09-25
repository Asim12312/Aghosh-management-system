import en, { type Dictionary } from "./en";
import ur from "./ur";

export type { Dictionary };
export const locales = ["en", "ur"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** A label carried in both languages, used by config-driven screens (reports, master data). */
export type L = { en: string; ur: string };

const dictionaries: Record<Locale, Dictionary> = { en, ur };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function dirOf(locale: Locale) {
  return locale === "ur" ? "rtl" : "ltr";
}

/** Replaces {name} placeholders. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function tl(label: L, locale: Locale) {
  return label[locale] || label.en;
}

/** Picks the Urdu or English name column from a master-data row. */
export function nm(row: { name_en?: string | null; name_ur?: string | null } | null | undefined, locale: Locale) {
  if (!row) return "";
  return (locale === "ur" ? row.name_ur || row.name_en : row.name_en || row.name_ur) ?? "";
}

// Numbers stay in Western digits in both languages (common practice in Pakistani offices).
const numFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const num1Fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const moneyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Karachi";

export function fmtNum(n: number | null | undefined) {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : numFmt.format(n);
}
export function fmtKm(n: number | null | undefined) {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : num1Fmt.format(n);
}
export function fmtMoney(n: number | null | undefined) {
  return n === null || n === undefined || Number.isNaN(n) ? "—" : moneyFmt.format(n);
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function fmtTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}

/** Today's date in the facility's timezone, as 'YYYY-MM-DD'. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

/** Current local time in the facility's timezone as a datetime-local value 'YYYY-MM-DDTHH:mm'. */
export function nowLocalInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
