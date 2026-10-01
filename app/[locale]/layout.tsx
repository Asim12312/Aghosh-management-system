import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Noto_Nastaliq_Urdu } from "next/font/google";
import { dirOf, getDictionary, isLocale, locales } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/client";
import { ServiceWorkerRegister } from "@/components/pwa";
import "../globals.css";

const latin = Geist({ subsets: ["latin"] });
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], weight: ["400", "600", "700"] });

// Geist (Latin-only unicode-range) first, then Nastaliq for Urdu glyphs. Geist's generated fallback
// font is left out on purpose: it maps to local Arial, which would render Urdu before Nastaliq.
const fontVars = {
  "--font-latin": latin.style.fontFamily.split(",")[0],
  "--font-urdu": urdu.style.fontFamily,
} as React.CSSProperties;

export const viewport: Viewport = {
  themeColor: "#134e4a",
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(isLocale(locale) ? locale : "en");
  return {
    title: { default: d.app.name, template: `%s · ${d.app.name}` },
    description: d.app.org,
    applicationName: d.app.name,
    appleWebApp: { capable: true, title: "Aghosh MIS", statusBarStyle: "default" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} dir={dirOf(locale)} className="h-full antialiased" style={fontVars}>
      <body className="min-h-full font-sans">
        <I18nProvider locale={locale} d={getDictionary(locale)}>
          {children}
          <ServiceWorkerRegister />
        </I18nProvider>
      </body>
    </html>
  );
}
