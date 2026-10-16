import "server-only";
import { revalidateTag } from "next/cache";
import { findCustomer } from "@/lib/customers";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { createCustomerOrder, OrderError } from "@/lib/orders";
import { TAG } from "@/lib/store-data";
import { notifyNewOrder, notifyOrderStatus } from "@/lib/whatsapp/notify";
import { isWebChat, phoneKey } from "@/lib/whatsapp/phone";
import { type Draft, draftSignature, parseDraft } from "./quote";

export type ConfirmedOrder = { id: number; publicToken: string; total: number; paymentMethod: string; locale: string };

export type ConfirmResult = { ok: true; order: ConfirmedOrder } | { ok: false; error: string; stale?: boolean };

const ERR = {
  es: {
    gone: "La conversación ya no existe.",
    stale: "Tu pedido cambió desde esta cotización. Revisa la cotización nueva.",
    name: "Falta saber cómo te llamas.",
    phone: "Falta tu teléfono para avisarte de tu pedido.",
    delivery: "Falta elegir si lo recoges o te lo llevamos.",
    address: "Falta la dirección de entrega.",
    payment: "Falta la forma de pago.",
  },
  en: {
    gone: "This conversation no longer exists.",
    stale: "Your order changed since this quote. Please check the new quote.",
    name: "We still need your name.",
    phone: "We need your phone number to update you about your order.",
    delivery: "Please choose pickup or delivery.",
    address: "The delivery address is missing.",
    payment: "The payment method is missing.",
  },
};

/** Convierte el pedido en curso de una conversación en un pedido real y vacía el carrito. */
export async function confirmConversationOrder(
  conversationId: number,
  opts: { locale: Locale; signature?: string },
): Promise<ConfirmResult> {
  const e = ERR[opts.locale];
  const conversation = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return { ok: false, error: e.gone };
  const draft = parseDraft(conversation.draft);
  if (opts.signature && opts.signature !== draftSignature(draft)) return { ok: false, error: e.stale, stale: true };

  const web = isWebChat(conversation.waId);
  const phone = web ? (draft.phone ?? "") : conversation.waId;
  const customer = phoneKey(phone).length === 10 ? await findCustomer(phone) : null;
  const name = web ? draft.customerName || customer?.name || "" : customer?.name || "";

  if (!name) return { ok: false, error: e.name };
  if (web && phoneKey(phone).length < 10) return { ok: false, error: e.phone };
  if (!draft.deliveryType) return { ok: false, error: e.delivery };
  if (draft.deliveryType === "DELIVERY" && !draft.address) return { ok: false, error: e.address };
  if (!draft.paymentMethod) return { ok: false, error: e.payment };

  try {
    const order = await createCustomerOrder({
      channel: web ? "ONLINE" : "WHATSAPP",
      locale: opts.locale,
      customerName: name,
      phone,
      waId: web ? undefined : conversation.waId,
      recipientName: draft.recipientName,
      deliveryType: draft.deliveryType,
      address: draft.address ?? "",
      notes: draft.notes ?? "",
      paymentMethod: draft.paymentMethod,
      cashGivenWith: draft.cashGivenWith ?? null,
      items: draft.items,
    });

    // El carrito y la entrega se vacían (el siguiente pedido vuelve a preguntar a dónde va);
    // en la web se recuerdan nombre y teléfono para no volver a pedirlos.
    const next: Draft = web ? { items: [], customerName: draft.customerName, phone: draft.phone } : { items: [] };
    await db.whatsAppConversation.update({ where: { id: conversationId }, data: { draft: JSON.stringify(next) } });

    try {
      revalidateTag(TAG.products, "max");
    } catch (err) {
      console.error("[pedido] no se pudo refrescar el catálogo:", err);
    }
    void notifyNewOrder(order.id);
    if (web) void notifyOrderStatus(order.id);

    return {
      ok: true,
      order: { id: order.id, publicToken: order.publicToken, total: order.total, paymentMethod: draft.paymentMethod, locale: order.locale },
    };
  } catch (err) {
    if (err instanceof OrderError) return { ok: false, error: err.message };
    throw err;
  }
}
