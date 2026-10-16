import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { TIME_ZONE, formatMoney } from "@/lib/format";

// Promociones: se evalúan con el pedido en curso y devuelven los descuentos que aplican
// y los que aplicarían si el cliente pagara de otra forma (para sugerírselo).

type Client = Prisma.TransactionClient | typeof db;

export type AppliedPromotion = { id: number; name: string; nameEn: string; amount: number };
export type PromotionSuggestion = AppliedPromotion & { paymentMethods: string[] };

export type PromotionInput = {
  lines: { productId: number; categoryId: number | null; lineTotal: number }[];
  paymentMethod?: string;
  deliveryType?: string;
  now?: Date;
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Día de la semana en la Ciudad de México (0 = domingo). */
export function localWeekday(date = new Date()) {
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE }).format(date);
  return WEEKDAY_INDEX[short] ?? date.getDay();
}

export function splitList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function activePromotions(client: Client = db) {
  return client.promotion.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}

export async function evaluatePromotions(input: PromotionInput, client: Client = db) {
  const promotions = await activePromotions(client);
  const subtotal = input.lines.reduce((s, l) => s + l.lineTotal, 0);
  const today = localWeekday(input.now);
  const applied: AppliedPromotion[] = [];
  const suggestions: PromotionSuggestion[] = [];

  for (const p of promotions) {
    const days = splitList(p.weekdays).map(Number);
    if (days.length && !days.includes(today)) continue;
    if (p.minSubtotal > 0 && subtotal < p.minSubtotal) continue;
    if (p.deliveryType && input.deliveryType && p.deliveryType !== input.deliveryType) continue;
    if (p.deliveryType && !input.deliveryType) continue;

    const base = p.categoryId ? input.lines.filter((l) => l.categoryId === p.categoryId).reduce((s, l) => s + l.lineTotal, 0) : subtotal;
    if (base <= 0) continue;
    const amount = p.kind === "FIXED" ? Math.min(p.value, base) : Math.round((base * Math.min(Math.max(p.value, 0), 100)) / 100);
    if (amount <= 0) continue;

    const methods = splitList(p.paymentMethods);
    const promo = { id: p.id, name: p.name, nameEn: p.nameEn, amount };
    if (methods.length && (!input.paymentMethod || !methods.includes(input.paymentMethod))) {
      suggestions.push({ ...promo, paymentMethods: methods });
      continue;
    }
    applied.push(promo);
  }

  // El descuento nunca puede pasar del subtotal.
  let remaining = subtotal;
  for (const a of applied) {
    a.amount = Math.min(a.amount, remaining);
    remaining -= a.amount;
  }
  const finalApplied = applied.filter((a) => a.amount > 0);
  return { applied: finalApplied, discount: subtotal - remaining, suggestions };
}

const PAYMENT_ES: Record<string, string> = { CASH: "efectivo", CARD: "tarjeta", TRANSFER: "transferencia" };
const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Descripción de las condiciones en español (panel y bot). */
export function describePromotion(p: {
  kind: string;
  value: number;
  paymentMethods: string;
  deliveryType: string;
  minSubtotal: number;
  weekdays: string;
  category?: { name: string } | null;
}) {
  const parts = [p.kind === "FIXED" ? `${formatMoney(p.value)} de descuento` : `${p.value}% de descuento`];
  if (p.category) parts.push(`en ${p.category.name}`);
  const methods = splitList(p.paymentMethods);
  if (methods.length) parts.push(`pagando con ${methods.map((m) => PAYMENT_ES[m] ?? m).join(" o ")}`);
  if (p.deliveryType) parts.push(p.deliveryType === "DELIVERY" ? "con envío a domicilio" : "recogiendo en tienda");
  if (p.minSubtotal > 0) parts.push(`en compras desde ${formatMoney(p.minSubtotal)}`);
  const days = splitList(p.weekdays).map(Number);
  if (days.length) parts.push(`los ${days.map((d) => DAYS_ES[d]).join(", ")}`);
  return parts.join(" ");
}
