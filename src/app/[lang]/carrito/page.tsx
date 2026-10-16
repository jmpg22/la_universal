import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

// Los pedidos ahora se hacen en el chat: esta dirección abre la portada con el chat abierto.
export default async function OrderRedirect() {
  const { lang } = await getI18n();
  redirect(`${localePath(lang, "/")}?pedido=1`);
}
