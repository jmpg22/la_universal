import "server-only";
import { db } from "@/lib/db";
import { DELIVERY_LABEL, formatMoney } from "@/lib/format";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { customerMessage } from "@/lib/order-flow";
import { orderTrackingUrl } from "@/lib/orders";
import { whatsappConfig } from "./cloud-api";
import { deliver, findConversationByPhone, getOrCreateConversation } from "./conversations";
import { toWaId } from "./phone";

async function settings() {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Avisa al cliente el estado actual de su pedido. Nunca lanza: un aviso fallido no debe romper el pedido. */
export async function notifyOrderStatus(orderId: number) {
  try {
    const [s, order] = await Promise.all([settings(), db.order.findUnique({ where: { id: orderId } })]);
    if (!s.notifyCustomers || !order || order.channel === "COUNTER" || !order.phone) return;

    const conversation =
      (await findConversationByPhone(order.phone)) ?? (await getOrCreateConversation(toWaId(order.phone), order.customerName));
    // El aviso va en el idioma en que el cliente hizo el pedido.
    const english = order.locale === "en";
    const track = english ? "Track your order here" : "Sigue tu pedido aquí";
    const text = `${customerMessage({ ...order, total: formatMoney(order.total) })}\n\n${track}: ${orderTrackingUrl(order)}`;
    const { orderUpdateTemplate, templateLang, templateLangEn } = whatsappConfig();
    await deliver(conversation, "SYSTEM", text, {
      name: orderUpdateTemplate,
      languageCode: english ? templateLangEn : templateLang,
      params: [
        order.customerName.split(" ")[0] || (english ? "there" : "cliente"),
        `#${order.id}`,
        getDictionary(english ? "en" : "es").status[order.status].toLowerCase(),
      ],
    });
  } catch (e) {
    console.error("[whatsapp] no se pudo avisar al cliente:", e);
  }
}

/** Avisa a la tienda que entró un pedido nuevo. */
export async function notifyNewOrder(orderId: number) {
  try {
    const [s, order] = await Promise.all([
      settings(),
      db.order.findUnique({ where: { id: orderId }, include: { items: true } }),
    ]);
    if (!s.notifyStore || !s.storeNotifyPhone || !order) return;

    const conversation = await getOrCreateConversation(toWaId(s.storeNotifyPhone), "Avisos de la tienda");
    const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const text = [
      `🛒 Pedido nuevo #${order.id} ${order.channel === "WHATSAPP" ? "por WhatsApp" : "en la web"}`,
      `${order.customerName} · ${order.phone}`,
      `${DELIVERY_LABEL[order.deliveryType]}${order.deliveryType === "DELIVERY" ? `: ${order.address}` : ""}`,
      ...(order.recipientName ? [`Recibe: ${order.recipientName}`] : []),
      ...order.items.map((i) => `• ${i.quantity} × ${i.name}`),
      `Total: ${formatMoney(order.total)}`,
      `${base}/admin/pedidos/${order.id}`,
    ].join("\n");
    const { newOrderTemplate } = whatsappConfig();
    await deliver(conversation, "SYSTEM", text, {
      name: newOrderTemplate,
      params: [`#${order.id}`, order.customerName, formatMoney(order.total)],
    });
  } catch (e) {
    console.error("[whatsapp] no se pudo avisar a la tienda:", e);
  }
}
