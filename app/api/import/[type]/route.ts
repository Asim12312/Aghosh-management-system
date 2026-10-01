import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal/auth";
import { getImporter, runImport } from "@/lib/importers";
import { getDictionary, isLocale } from "@/lib/i18n";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB

/** POST multipart form (file, locale) → JSON ImportResult */
export async function POST(request: Request, ctx: RouteContext<"/api/import/[type]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Unauthorized", errors: [] }, { status: 401 });
  const def = getImporter((await ctx.params).type);
  if (!def) return Response.json({ ok: false, error: "Not found", errors: [] }, { status: 404 });

  const form = await request.formData();
  const localeParam = form.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "en";
  const d = getDictionary(locale);
  if (def.adminOnly && user.role !== "admin") return Response.json({ ok: false, error: d.auth.forbidden, errors: [] }, { status: 403 });

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ ok: false, error: d.importer.chooseFile, errors: [] }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, error: d.importer.tooLarge, errors: [] }, { status: 413 });
  if (!/\.xlsx$/i.test(file.name)) return Response.json({ ok: false, error: d.importer.badFile, errors: [] }, { status: 400 });

  const result = await runImport(def, await file.arrayBuffer(), user.id, locale, d);
  if (result.ok) revalidatePath(`/${locale}`, "layout");
  return Response.json(result);
}
