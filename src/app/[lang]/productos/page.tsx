import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

// El catálogo vive en la portada. Los enlaces viejos (/productos?categoria=… o ?q=…) llevan a su sección.
export default async function ProductsRedirect({ searchParams }: PageProps<"/[lang]/productos">) {
  const { lang } = await getI18n();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const category = typeof params.categoria === "string" ? params.categoria : "";
  redirect(`${localePath(lang, "/")}${q ? `?q=${encodeURIComponent(q)}` : ""}#${category ? `cat-${category}` : "catalogo"}`);
}
