"use server";

import { refresh, revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/format";
import { isClaudeConfigured } from "@/lib/anthropic";
import { TAG } from "@/lib/store-data";
import { translateMissing } from "@/lib/translate";

export type SettingsState = { error?: string; ok?: string } | undefined;

const text = (max: number) => z.string().trim().max(max);

const schema = z.object({
  storeName: text(80).min(2, "Escribe el nombre de la tienda"),
  tagline: text(120),
  announcement: text(160),
  heroTitle: text(120).min(2, "Escribe el título de la portada"),
  heroSubtitle: text(300),
  phone: text(30),
  whatsapp: z.string().trim().regex(/^\d{0,15}$/, "WhatsApp: solo números, con lada de país (ej. 5215512345678)"),
  email: z.union([z.literal(""), z.string().trim().email("Correo no válido")]),
  address: text(200),
  hours: text(200),
  deliveryArea: text(200),
  storeNotifyPhone: z.string().trim().regex(/^[\d\s()+-]{0,20}$/, "Número para avisos: solo dígitos"),
  botInstructions: text(2000),
  bankName: text(60),
  bankAccountHolder: text(100),
  bankAccount: z.string().trim().regex(/^[\d\s-]{0,24}$/, "Número de cuenta: solo dígitos"),
  bankClabe: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => v === "" || /^\d{18}$/.test(v), "La CLABE debe tener 18 dígitos"),
  bankCard: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v === "" || /^\d{15,16}$/.test(v), "La tarjeta debe tener 16 dígitos"),
  bankNote: text(300),
  taglineEn: text(120),
  announcementEn: text(160),
  heroTitleEn: text(120),
  heroSubtitleEn: text(300),
  hoursEn: text(200),
  deliveryAreaEn: text(200),
  chatWelcome: text(400),
  chatWelcomeEn: text(400),
  botAskName: text(160).min(3, "Escribe la pregunta del nombre"),
  botAskPhone: text(160).min(3, "Escribe la pregunta del teléfono"),
  botAskDelivery: text(160).min(3, "Escribe la pregunta de la entrega"),
  botAskPayment: text(160).min(3, "Escribe la pregunta del pago"),
});

// Pares español → inglés de los textos de la tienda.
const EN_PAIRS = [
  ["tagline", "taglineEn"],
  ["announcement", "announcementEn"],
  ["heroTitle", "heroTitleEn"],
  ["heroSubtitle", "heroSubtitleEn"],
  ["hours", "hoursEn"],
  ["deliveryArea", "deliveryAreaEn"],
  ["chatWelcome", "chatWelcomeEn"],
] as const;

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const get = (k: string) => String(formData.get(k) ?? "");
  const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, get(k)])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const deliveryFee = parseMoney(formData.get("deliveryFee")) ?? 0;
  const freeDeliveryMin = parseMoney(formData.get("freeDeliveryMin")) ?? 0;
  const minOrder = parseMoney(formData.get("minOrder")) ?? 0;
  const pickupEnabled = formData.get("pickupEnabled") === "on";
  const deliveryEnabled = formData.get("deliveryEnabled") === "on";
  if (!pickupEnabled && !deliveryEnabled) return { error: "Activa al menos una forma de entrega (recoger o envío)." };

  const data = {
    ...parsed.data,
    deliveryFee,
    freeDeliveryMin,
    minOrder,
    pickupEnabled,
    deliveryEnabled,
    acceptingOrders: formData.get("acceptingOrders") === "on",
    botEnabled: formData.get("botEnabled") === "on",
    notifyCustomers: formData.get("notifyCustomers") === "on",
    notifyStore: formData.get("notifyStore") === "on",
    announcementFromPromos: formData.get("announcementFromPromos") === "on",
  };
  // Si cambió un texto en español y su inglés quedó igual, la traducción vieja ya no sirve.
  const current = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  for (const [es, en] of EN_PAIRS) {
    if (current[es] !== data[es] && current[en] === data[en]) data[en] = "";
  }
  await db.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  updateTag(TAG.settings);
  refresh();

  const needsTranslation = EN_PAIRS.some(([es, en]) => data[es] && !data[en]);
  if (needsTranslation && isClaudeConfigured()) {
    after(async () => {
      try {
        await translateMissing();
        revalidateTag(TAG.settings, "max");
        revalidateTag(TAG.products, "max");
      } catch (e) {
        console.error("[traducción] ajustes", e);
      }
    });
    return { ok: "Cambios guardados. Los textos en inglés vacíos se están traduciendo y aparecerán en unos segundos." };
  }
  return { ok: "Cambios guardados. Ya se ven en la tienda." };
}

/** Interruptor rápido desde el inicio del panel. */
export async function setAcceptingOrders(value: boolean) {
  await requireAdmin();
  await db.settings.upsert({ where: { id: 1 }, update: { acceptingOrders: value }, create: { id: 1, acceptingOrders: value } });
  updateTag(TAG.settings);
  refresh();
}
