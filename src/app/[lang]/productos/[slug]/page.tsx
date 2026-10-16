import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

// Ya no hay página por producto: el enlace lleva a su tarjeta en el catálogo.
export default async function ProductRedirect({ params }: PageProps<"/[lang]/productos/[slug]">) {
  const { lang } = await getI18n();
  const { slug } = await params;
  redirect(`${localePath(lang, "/")}#p-${slug}`);
}
