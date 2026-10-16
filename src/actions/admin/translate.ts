"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { TAG } from "@/lib/store-data";
import { translateMissing } from "@/lib/translate";

export type TranslateState = { error?: string; ok?: string } | undefined;

/** Traduce con IA todo lo que aún no tenga texto en inglés. No toca lo que ya se escribió a mano. */
export async function translateMissingAction(): Promise<TranslateState> {
  await requireAdmin();
  try {
    const done = await translateMissing();
    updateTag(TAG.products);
    updateTag(TAG.categories);
    updateTag(TAG.settings);
    refresh();
    const total = done.products + done.categories + done.settings;
    if (total === 0) return { ok: "Todo ya estaba traducido." };
    return {
      ok: `Listo: ${done.products} productos, ${done.categories} categorías y ${done.settings} textos de la tienda traducidos al inglés.`,
    };
  } catch (e) {
    console.error("[traducción]", e);
    return { error: e instanceof Error ? e.message : "No se pudo traducir." };
  }
}
