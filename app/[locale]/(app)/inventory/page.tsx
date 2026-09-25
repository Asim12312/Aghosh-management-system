import { redirect } from "next/navigation";

export default async function Page({ params }: PageProps<"/[locale]/inventory">) {
  redirect(`/${(await params).locale}/inventory/items`);
}
