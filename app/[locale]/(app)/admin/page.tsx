import { redirect } from "next/navigation";

export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  redirect(`/${(await params).locale}/admin/users`);
}
