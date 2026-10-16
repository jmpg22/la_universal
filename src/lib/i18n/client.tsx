"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./config";
import { type Dictionary, getDictionary } from "./dictionaries";

const I18nContext = createContext<{ lang: Locale; t: Dictionary } | null>(null);

export function I18nProvider({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return <I18nContext value={{ lang, t: getDictionary(lang) }}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return ctx;
}
