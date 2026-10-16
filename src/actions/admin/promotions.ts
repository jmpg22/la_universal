"use server";

import { refresh, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { isClaudeConfigured } from "@/lib/anthropic";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/format";
import { TAG } from "@/lib/store-data";
import { translateToEnglish } from "@/lib/translate";

export type PromotionFormState = { error?: string } | undefined;

const PAYMENTS = ["CASH", "CARD", "TRANSFER"] as const;

const schema = z.object({
  name: z.string().trim().min(3, "Escribe el nombre que verá el cliente").max(120),
  nameEn: z.string().trim().max(120),
  kind: z.enum(["PERCENT", "FIXED"]),
  deliveryType: z.enum(["", "PICKUP", "DELIVERY"]),
  categoryId: z.coerce.number().int().nonnegative(),
});

export async function savePromotion(_prev: PromotionFormState, formData: FormData): Promise<PromotionFormState> {
  await requireAdmin();
  const id = Number(formData.get("id")) || undefined;
  const parsed = schema.safeParse({
    name: formData.get("name"),
    nameEn: formData.get("nameEn") ?? "",
    kind: formData.get("kind"),
    deliveryType: formData.get("deliveryType") ?? "",
    categoryId: formData.get("categoryId") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  let value: number;
  if (data.kind === "PERCENT") {
    value = Math.round(Number(formData.get("value")));
    if (!Number.isFinite(value) || value < 1 || value > 100) return { error: "El porcentaje debe ser de 1 a 100." };
  } else {
    const cents = parseMoney(formData.get("value"));
    if (!cents) return { error: "Escribe el monto del descuento en pesos." };
    value = cents;
  }
  const minSubtotal = parseMoney(formData.get("minSubtotal")) ?? 0;
  const paymentMethods = formData
    .getAll("paymentMethods")
    .map(String)
    .filter((m): m is (typeof PAYMENTS)[number] => (PAYMENTS as readonly string[]).includes(m));
  const weekdays = formData
    .getAll("weekdays")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  // Si cambió el nombre en español y el inglés quedó igual, se vuelve a traducir.
  let nameEn = data.nameEn;
  if (id) {
    const current = await db.promotion.findUnique({ where: { id } });
    if (!current) return { error: "La promoción ya no existe." };
    if (current.name !== data.name && current.nameEn === nameEn) nameEn = "";
  }

  const values = {
    name: data.name,
    nameEn,
    kind: data.kind,
    value,
    paymentMethods: paymentMethods.join(","),
    deliveryType: data.deliveryType,
    minSubtotal,
    categoryId: data.categoryId || null,
    weekdays: weekdays.sort().join(","),
    active: formData.get("active") === "on",
  };
  const saved = id ? await db.promotion.update({ where: { id }, data: values }) : await db.promotion.create({ data: values });

  if (!nameEn && isClaudeConfigured()) {
    after(async () => {
      try {
        const en = (await translateToEnglish({ name: saved.name })).get("name");
        if (!en) return;
        await db.promotion.update({ where: { id: saved.id }, data: { nameEn: en } });
        revalidateTag(TAG.promotions, "max");
      } catch (e) {
        console.error("[traducción] promoción", saved.id, e);
      }
    });
  }
  updateTag(TAG.promotions);
  redirect(`/admin/promociones?guardado=${saved.id}`);
}

export async function togglePromotion(id: number) {
  await requireAdmin();
  const p = await db.promotion.findUniqueOrThrow({ where: { id }, select: { active: true } });
  await db.promotion.update({ where: { id }, data: { active: !p.active } });
  updateTag(TAG.promotions);
  refresh();
}

export async function deletePromotion(id: number) {
  await requireAdmin();
  await db.promotion.delete({ where: { id } });
  updateTag(TAG.promotions);
  redirect("/admin/promociones");
}
