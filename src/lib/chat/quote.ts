import "server-only";
import { db } from "@/lib/db";
import { deliveryFeeFor } from "@/lib/pricing";
import { type AppliedPromotion, type PromotionSuggestion, evaluatePromotions } from "@/lib/promotions";

// Pedido en curso de una conversación (WhatsApp o chat web). Se guarda como JSON en la conversación.
export type Draft = {
  items: { productId: number; quantity: number }[];
  /** Solo chat web: en WhatsApp el nombre vive en el registro del cliente y el teléfono es el de WhatsApp. */
  customerName?: string;
  phone?: string;
  deliveryType?: "PICKUP" | "DELIVERY";
  address?: string;
  recipientName?: string;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER";
  cashGivenWith?: number | null;
  notes?: string;
  /** Idioma en que el cliente ve la página (chat web). */
  locale?: "es" | "en";
};

export function parseDraft(raw: string): Draft {
  try {
    const d = JSON.parse(raw);
    return { ...d, items: Array.isArray(d.items) ? d.items : [] };
  } catch {
    return { items: [] };
  }
}

export type MissingField = "items" | "name" | "phone" | "delivery" | "address" | "payment";

/** Cotización calculada con los precios y existencias reales. Es lo que ve el cliente en la tarjeta. */
export type Quote = {
  items: { productId: number; name: string; nameEn: string; unit: string; quantity: number; unitPrice: number; lineTotal: number; stock: number }[];
  subtotal: number;
  /** Promociones que ya aplican y las que aplicarían pagando de otra forma. */
  discounts: AppliedPromotion[];
  discount: number;
  suggestions: PromotionSuggestion[];
  deliveryFee: number;
  total: number;
  minOrder: number;
  customerName: string;
  phone: string;
  deliveryType?: "PICKUP" | "DELIVERY";
  address: string;
  recipientName: string;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER";
  cashGivenWith: number | null;
  missing: MissingField[];
  /** Huella del pedido: si cambia algo después de mostrar la tarjeta, ya no se puede confirmar esa tarjeta. */
  signature: string;
};

export function draftSignature(d: Draft) {
  return JSON.stringify([
    [...d.items].sort((a, b) => a.productId - b.productId).map((i) => [i.productId, i.quantity]),
    d.customerName ?? "",
    d.phone ?? "",
    d.deliveryType ?? "",
    d.address ?? "",
    d.recipientName ?? "",
    d.paymentMethod ?? "",
    d.cashGivenWith ?? null,
  ]);
}

export async function computeQuote(draft: Draft, opts: { needsContact: boolean; customerName?: string; phone?: string }): Promise<Quote> {
  const [settings, products] = await Promise.all([
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.product.findMany({
      where: { id: { in: draft.items.map((i) => i.productId) }, active: true },
      select: { id: true, name: true, nameEn: true, unit: true, price: true, stock: true, categoryId: true },
    }),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = draft.items.flatMap((i) => {
    const p = byId.get(i.productId);
    return p
      ? [{ productId: p.id, name: p.name, nameEn: p.nameEn, unit: p.unit, quantity: i.quantity, unitPrice: p.price, lineTotal: p.price * i.quantity, stock: p.stock }]
      : [];
  });
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = draft.deliveryType ? deliveryFeeFor(settings, subtotal, draft.deliveryType) : 0;
  const promos = await evaluatePromotions({
    lines: items.map((i) => ({ productId: i.productId, categoryId: byId.get(i.productId)?.categoryId ?? null, lineTotal: i.lineTotal })),
    paymentMethod: draft.paymentMethod,
    deliveryType: draft.deliveryType,
  });
  const customerName = opts.customerName ?? draft.customerName ?? "";
  const phone = opts.phone ?? draft.phone ?? "";

  const missing: MissingField[] = [];
  if (items.length === 0) missing.push("items");
  if (!customerName) missing.push("name");
  if (opts.needsContact && phone.replace(/\D/g, "").length < 10) missing.push("phone");
  if (!draft.deliveryType) missing.push("delivery");
  if (draft.deliveryType === "DELIVERY" && !draft.address) missing.push("address");
  if (!draft.paymentMethod) missing.push("payment");

  return {
    items,
    subtotal,
    discounts: promos.applied,
    discount: promos.discount,
    suggestions: promos.suggestions,
    deliveryFee,
    total: subtotal - promos.discount + deliveryFee,
    minOrder: settings.minOrder,
    customerName,
    phone,
    deliveryType: draft.deliveryType,
    address: draft.deliveryType === "DELIVERY" ? (draft.address ?? "") : "",
    recipientName: draft.recipientName ?? "",
    paymentMethod: draft.paymentMethod,
    cashGivenWith: draft.cashGivenWith ?? null,
    missing,
    signature: draftSignature(draft),
  };
}
