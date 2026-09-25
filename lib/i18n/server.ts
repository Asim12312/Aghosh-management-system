import "server-only";
import { cookies, headers } from "next/headers";
import { defaultLocale, getDictionary, isLocale, LOCALE_COOKIE, type Locale } from ".";

/** Locale for Server Actions and Route Handlers, which have no [locale] param. The proxy keeps this cookie in sync with the URL. */
export async function getRequestLocale(): Promise<Locale> {
  const fromProxy = (await headers()).get("x-locale");
  if (isLocale(fromProxy)) return fromProxy;
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getRequestDictionary() {
  const locale = await getRequestLocale();
  return { locale, d: getDictionary(locale) };
}
