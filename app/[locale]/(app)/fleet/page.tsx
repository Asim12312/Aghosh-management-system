import { redirect } from "next/navigation";

export default async function Page({ params }: PageProps<"/[locale]/fleet">) {
  redirect(`/${(await params).locale}/fleet/trips`);
}
