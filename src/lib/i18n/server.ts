import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { type Locale, isLocale } from "./config";
import { getDictionary } from "./dictionaries";

/** Idioma de la página actual, leído del segmento [lang] (solo en componentes de servidor de la tienda). */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

export async function getI18n() {
  const locale = await getLocale();
  return { lang: locale, t: getDictionary(locale) };
}
