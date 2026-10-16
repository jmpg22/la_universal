import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CLAUDE_MODEL, anthropic, isClaudeConfigured } from "@/lib/anthropic";
import { db } from "@/lib/db";

// Traducción al inglés de los textos de la tienda con Claude. Solo llena campos vacíos:
// lo que el dueño escriba a mano en el panel nunca se sobrescribe.

const SYSTEM = `Traduces al inglés (de Estados Unidos) los textos de la tienda en línea de un abarrotes de barrio en México.
- Escribe como lo diría una tienda en inglés, claro y natural para un turista. Ej.: "Refresco de cola 600 ml" → "Cola soda 600 ml", "Huevo blanco" → "White eggs", "Sopa de pasta 200 g" → "Pasta for soup 200 g".
- Conserva marcas, cantidades, unidades, números, precios y emojis.
- Si algo es muy mexicano y no tiene traducción (p. ej. "tortillas", "jalapeños"), déjalo y agrega una aclaración breve solo si ayuda.
- No traduzcas el nombre de la tienda ("La Universal").
- Devuelve exactamente un elemento por cada id recibido.`;

const ResultSchema = z.object({
  translations: z.array(z.object({ id: z.string(), en: z.string() })),
});

const BATCH = 40;

/** Traduce varios textos a la vez. Devuelve un mapa id → traducción (omite los que no regresen). */
export async function translateToEnglish(texts: Record<string, string>) {
  const entries = Object.entries(texts).filter(([, text]) => text.trim());
  const result = new Map<string, string>();
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = Object.fromEntries(entries.slice(i, i + BATCH));
    const response = await anthropic().beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: betaZodOutputFormat(ResultSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `Traduce estos textos (JSON id → texto):\n${JSON.stringify(chunk, null, 2)}` }],
    });
    if (response.stop_reason === "refusal") continue;
    for (const t of response.parsed_output?.translations ?? []) {
      if (t.id in chunk && t.en.trim()) result.set(t.id, t.en.trim());
    }
  }
  return result;
}

const SETTINGS_FIELDS = [
  ["tagline", "taglineEn"],
  ["announcement", "announcementEn"],
  ["heroTitle", "heroTitleEn"],
  ["heroSubtitle", "heroSubtitleEn"],
  ["hours", "hoursEn"],
  ["deliveryArea", "deliveryAreaEn"],
] as const;

/** Llena todas las traducciones vacías: productos, categorías y textos de la tienda. */
export async function translateMissing() {
  if (!isClaudeConfigured()) throw new Error("Falta ANTHROPIC_API_KEY en .env para traducir con IA.");

  const [products, categories, settings] = await Promise.all([
    db.product.findMany({
      where: { OR: [{ nameEn: "" }, { AND: [{ descriptionEn: "" }, { NOT: { description: "" } }] }] },
      select: { id: true, name: true, nameEn: true, description: true, descriptionEn: true },
    }),
    db.category.findMany({ where: { nameEn: "" }, select: { id: true, name: true } }),
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);

  const texts: Record<string, string> = {};
  for (const p of products) {
    if (!p.nameEn) texts[`p${p.id}.name`] = p.name;
    if (!p.descriptionEn && p.description) texts[`p${p.id}.desc`] = p.description;
  }
  for (const c of categories) texts[`c${c.id}`] = c.name;
  for (const [es, en] of SETTINGS_FIELDS) {
    if (!settings[en] && settings[es]) texts[`s.${es}`] = settings[es];
  }
  if (Object.keys(texts).length === 0) return { products: 0, categories: 0, settings: 0 };

  const done = await translateToEnglish(texts);

  let productCount = 0;
  for (const p of products) {
    const nameEn = done.get(`p${p.id}.name`);
    const descriptionEn = done.get(`p${p.id}.desc`);
    if (!nameEn && !descriptionEn) continue;
    await db.product.update({ where: { id: p.id }, data: { ...(nameEn && { nameEn }), ...(descriptionEn && { descriptionEn }) } });
    productCount++;
  }
  let categoryCount = 0;
  for (const c of categories) {
    const nameEn = done.get(`c${c.id}`);
    if (!nameEn) continue;
    await db.category.update({ where: { id: c.id }, data: { nameEn } });
    categoryCount++;
  }
  const settingsData: Partial<Record<(typeof SETTINGS_FIELDS)[number][1], string>> = {};
  for (const [es, en] of SETTINGS_FIELDS) {
    const value = done.get(`s.${es}`);
    if (value) settingsData[en] = value;
  }
  if (Object.keys(settingsData).length) await db.settings.update({ where: { id: 1 }, data: settingsData });

  return { products: productCount, categories: categoryCount, settings: Object.keys(settingsData).length };
}

/** Traduce un producto recién guardado si le faltan los textos en inglés (se llama después de responder). */
export async function translateProductIfMissing(productId: number) {
  if (!isClaudeConfigured()) return false;
  const p = await db.product.findUnique({ where: { id: productId } });
  if (!p) return false;
  const texts: Record<string, string> = {};
  if (!p.nameEn) texts.name = p.name;
  if (!p.descriptionEn && p.description) texts.desc = p.description;
  if (Object.keys(texts).length === 0) return false;
  const done = await translateToEnglish(texts);
  const nameEn = done.get("name");
  const descriptionEn = done.get("desc");
  if (!nameEn && !descriptionEn) return false;
  await db.product.update({ where: { id: productId }, data: { ...(nameEn && { nameEn }), ...(descriptionEn && { descriptionEn }) } });
  return true;
}
