import { getCurrentUser } from "@/lib/dal/auth";
import { buildTemplate, getImporter } from "@/lib/importers";
import { isLocale } from "@/lib/i18n";

/** GET ?locale=en|ur → .xlsx template with headers, an example row and dropdowns of valid values. */
export async function GET(request: Request, ctx: RouteContext<"/api/import/[type]/template">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const def = getImporter((await ctx.params).type);
  if (!def) return new Response("Not found", { status: 404 });
  const localeParam = new URL(request.url).searchParams.get("locale");
  const body = await buildTemplate(def, isLocale(localeParam) ? localeParam : "en");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aghosh-import-${def.key}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
