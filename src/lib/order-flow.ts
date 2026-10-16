import type { DeliveryType, OrderStatus } from "@/generated/prisma/enums";

export const ACTIVE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

/** Siguiente paso natural del pedido y el texto del botón para avanzarlo. */
export function nextStep(status: OrderStatus, deliveryType: DeliveryType): { status: OrderStatus; label: string } | null {
  switch (status) {
    case "PENDING":
      return { status: "CONFIRMED", label: "Confirmar pedido" };
    case "CONFIRMED":
      return { status: "PREPARING", label: "Empezar a preparar" };
    case "PREPARING":
      return deliveryType === "DELIVERY"
        ? { status: "OUT_FOR_DELIVERY", label: "Salió a entregar" }
        : { status: "READY", label: "Listo para recoger" };
    case "READY":
    case "OUT_FOR_DELIVERY":
      return { status: "DELIVERED", label: "Marcar entregado" };
    default:
      return null;
  }
}

/** Mensaje para avisar al cliente por WhatsApp según el estado, en su idioma. */
export function customerMessage(order: {
  id: number;
  customerName: string;
  status: OrderStatus;
  deliveryType: DeliveryType;
  total: string;
  locale?: string;
}) {
  const name = order.customerName.split(" ")[0];
  const delivery = order.deliveryType === "DELIVERY";
  if (order.locale === "en") {
    switch (order.status) {
      case "PENDING":
        return `Hi ${name}! We got your order #${order.id} for ${order.total}. We'll confirm it shortly.`;
      case "CONFIRMED":
        return `Hi ${name}! Your order #${order.id} is confirmed. We'll let you know when it's ${delivery ? "on the way" : "ready for pickup"}.`;
      case "PREPARING":
        return `Hi ${name}! We're preparing your order #${order.id}.`;
      case "READY":
        return `Hi ${name}! Your order #${order.id} is ready. Come pick it up whenever you like. Total: ${order.total}.`;
      case "OUT_FOR_DELIVERY":
        return `Hi ${name}! Your order #${order.id} is on the way. Amount due: ${order.total}.`;
      case "DELIVERED":
        return `Thanks for your purchase, ${name}! Hope to see you again soon.`;
      case "CANCELLED":
        return `Hi ${name}, your order #${order.id} was cancelled. Message us if you have any questions.`;
    }
  }
  switch (order.status) {
    case "PENDING":
      return `¡Hola ${name}! Recibimos tu pedido #${order.id} por ${order.total}. En un momento lo confirmamos.`;
    case "CONFIRMED":
      return `¡Hola ${name}! Tu pedido #${order.id} está confirmado. Te avisamos cuando esté ${delivery ? "en camino" : "listo para recoger"}.`;
    case "PREPARING":
      return `¡Hola ${name}! Ya estamos preparando tu pedido #${order.id}.`;
    case "READY":
      return `¡Hola ${name}! Tu pedido #${order.id} ya está listo. Puedes pasar por él cuando gustes. Total: ${order.total}.`;
    case "OUT_FOR_DELIVERY":
      return `¡Hola ${name}! Tu pedido #${order.id} va en camino. Total a pagar: ${order.total}.`;
    case "DELIVERED":
      return `¡Gracias por tu compra, ${name}! Esperamos verte pronto.`;
    case "CANCELLED":
      return `Hola ${name}, tu pedido #${order.id} fue cancelado. Si tienes dudas, escríbenos.`;
  }
}
