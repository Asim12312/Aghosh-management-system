import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "@/lib/i18n";

const SESSION_COOKIE = "aghosh_session";

// Optimistic checks only: add a locale prefix, keep the locale cookie in sync, and send
// visitors without a session cookie to the login page. Real authorization happens in lib/dal.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, first, second] = pathname.split("/");

  if (!isLocale(first)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
    const rest = pathname === "/" ? "/dashboard" : pathname;
    return NextResponse.redirect(new URL(`/${locale}${rest}${search}`, request.url));
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = second === "login";
  let response: NextResponse;
  if (!hasSession && !isLogin) {
    response = NextResponse.redirect(new URL(`/${first}/login`, request.url));
  } else if (!second) {
    response = NextResponse.redirect(new URL(`/${first}/dashboard`, request.url));
  } else {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-locale", first);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
    response.cookies.set(LOCALE_COOKIE, first, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
