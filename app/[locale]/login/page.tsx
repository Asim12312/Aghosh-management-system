import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal/auth";
import { getDictionary, type Locale } from "@/lib/i18n";
import { login, setupAdmin } from "@/lib/actions/auth";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { LanguageToggle } from "@/components/language-toggle";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const locale = (await params).locale as Locale;
  const d = getDictionary(locale);
  if (await getCurrentUser()) redirect(`/${locale}/dashboard`);
  const hasUsers = ((await one<{ n: number }>("SELECT count(*)::int AS n FROM users"))?.n ?? 0) > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand-700 text-2xl font-bold text-white shadow">
            {locale === "ur" ? "آ" : "A"}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{d.app.org}</h1>
          <p className="text-sm text-slate-500">{d.app.tagline}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {hasUsers ? (
            <>
              <h2 className="text-lg font-semibold">{d.auth.title}</h2>
              <p className="mb-4 text-sm text-slate-500">{d.auth.subtitle}</p>
              <ActionForm action={login} className="space-y-4">
                <TextField name="username" label={d.auth.username} autoComplete="username" autoFocus required />
                <TextField name="password" label={d.auth.password} type="password" autoComplete="current-password" required />
                <SubmitButton className="w-full">{d.auth.signIn}</SubmitButton>
              </ActionForm>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{d.auth.setupTitle}</h2>
              <p className="mb-4 text-sm text-slate-500">{d.auth.setupHint}</p>
              <ActionForm action={setupAdmin} className="space-y-4">
                <TextField name="full_name" label={d.auth.fullName} required autoFocus />
                <TextField name="username" label={d.auth.username} autoComplete="username" required />
                <TextField name="password" label={d.auth.password} type="password" autoComplete="new-password" required />
                <TextField name="confirm" label={d.auth.confirmPassword} type="password" autoComplete="new-password" required />
                <SubmitButton className="w-full">{d.auth.createAdmin}</SubmitButton>
              </ActionForm>
            </>
          )}
        </div>
        <div className="mt-4 flex justify-center">
          <LanguageToggle />
        </div>
      </div>
    </main>
  );
}
