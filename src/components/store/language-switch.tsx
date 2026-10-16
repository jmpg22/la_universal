"use client";

import { LANG_COOKIE, type Locale, localePath, stripLocale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

/**
 * Botón ES/EN. Lleva a la misma página en el otro idioma y recuerda la elección en una cookie.
 * La ruta destino se calcula al hacer clic con la URL real del navegador (el español se sirve reescrito).
 */
export function LanguageSwitch() {
  const { lang, t } = useI18n();
  const target: Locale = lang === "es" ? "en" : "es";

  return (
    <a
      href={localePath(target, "/")}
      hrefLang={target}
      lang={target}
      aria-label={t.header.switchAria}
      title={t.header.switchAria}
      onClick={(e) => {
        e.preventDefault();
        document.cookie = `${LANG_COOKIE}=${target}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        const { pathname, search, hash } = window.location;
        window.location.assign(localePath(target, stripLocale(pathname)) + search + hash);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-bold text-stone-700 shadow-sm ring-1 ring-black/10 transition hover:bg-stone-50"
    >
      <span aria-hidden>🌐</span>
      <span className="sm:hidden">{t.header.switchToShort}</span>
      <span className="hidden sm:inline">{t.header.switchTo}</span>
    </a>
  );
}
