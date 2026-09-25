import { requireUser } from "@/lib/dal/auth";

export default async function PrintLayout({ children }: LayoutProps<"/[locale]">) {
  await requireUser();
  return children;
}
