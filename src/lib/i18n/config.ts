// Idiomas de la tienda. El español es el principal y vive sin prefijo ("/productos");
// el inglés vive bajo "/en" ("/en/productos").

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** Cookie que recuerda el idioma elegido con el botón ES/EN. */
export const LANG_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Ruta pública para un idioma: localePath("en", "/productos") → "/en/productos". */
export function localePath(lang: Locale, path: string) {
  if (lang === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/** Quita el prefijo de idioma de una ruta: "/en/productos" → "/productos". */
export function stripLocale(pathname: string) {
  for (const l of LOCALES) {
    if (l === DEFAULT_LOCALE) continue;
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

/** Texto en inglés si existe; si no, el de español. */
export function pick(lang: Locale, es: string, en?: string | null) {
  return lang === "en" && en?.trim() ? en : es;
}

export const INTL_LOCALE: Record<Locale, string> = { es: "es-MX", en: "en-US" };
