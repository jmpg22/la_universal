import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { DeliveryType, OrderChannel, PaymentMethod } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/format";
import { type Locale, localePath, pick } from "@/lib/i18n/config";
import { changeStock, InventoryError } from "@/lib/inventory";
import { deliveryFeeFor } from "@/lib/pricing";
import { evaluatePromotions } from "@/lib/promotions";
import { phoneKey } from "@/lib/whatsapp/phone";

/** Error con un mensaje que se le puede mostrar al cliente tal cual (ya en su idioma). */
export class OrderError extends Error {}

const MESSAGES = {
  es: {
    noItems: "El pedido no tiene productos.",
    notAccepting: "Por el momento no estamos recibiendo pedidos.",
    noDelivery: "El envío a domicilio no está disponible ahora.",
    noPickup: "Recoger en tienda no está disponible ahora.",
    noAddress: "Falta la dirección completa de entrega.",
    unavailable: "Uno de los productos ya no está disponible.",
    minOrder: (min: string) => `El pedido mínimo es de ${min}.`,
    onlyLeft: (n: number, name: string) => `Solo quedan ${n} de "${name}".`,
    soldOut: (name: string) => `"${name}" está agotado.`,
  },
  en: {
    noItems: "Your order has no products.",
    notAccepting: "We're not taking orders right now.",
    noDelivery: "Home delivery isn't available right now.",
    noPickup: "Store pickup isn't available right now.",
    noAddress: "Please provide the full delivery address.",
    unavailable: "One of the products is no longer available.",
    minOrder: (min: string) => `The minimum order is ${min}.`,
    onlyLeft: (n: number, name: string) => `Only ${n} of "${name}" left.`,
    soldOut: (name: string) => `"${name}" is sold out.`,
  },
} satisfies Record<Locale, unknown>;

export type NewOrderInput = {
  channel: Exclude<OrderChannel, "COUNTER">;
  customerName: string;
  phone: string;
  deliveryType: DeliveryType;
  address: string;
  notes: string;
  paymentMethod: PaymentMethod;
  cashGivenWith: number | null;
  /** Quién recibe, cuando el pedido es para otra persona. */
  recipientName?: string;
  /** Dirección de WhatsApp del cliente, si el pedido llegó por ahí. */
  waId?: string;
  /** Idioma del cliente: mensajes de error, avisos y enlace de seguimiento. */
  locale?: Locale;
  items: { productId: number; quantity: number }[];
};

/**
 * Crea un pedido de cliente (web o WhatsApp): valida reglas de la tienda, precios actuales y stock,
 * y descuenta inventario, todo en una transacción. Lanza OrderError con un mensaje para el cliente.
 */
export async function createCustomerOrder(input: NewOrderInput) {
  const locale = input.locale ?? "es";
  const m = MESSAGES[locale];
  const quantities = new Map<number, number>();
  for (const { productId, quantity } of input.items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  if (quantities.size === 0) throw new OrderError(m.noItems);

  try {
    return await db.$transaction(async (tx) => {
      const settings = await tx.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      if (!settings.acceptingOrders) throw new OrderError(m.notAccepting);
      if (input.deliveryType === "DELIVERY" && !settings.deliveryEnabled)
        throw new OrderError(m.noDelivery);
      if (input.deliveryType === "PICKUP" && !settings.pickupEnabled)
        throw new OrderError(m.noPickup);
      if (input.deliveryType === "DELIVERY" && input.address.trim().length < 8)
        throw new OrderError(m.noAddress);

      const products = await tx.product.findMany({
        where: { id: { in: [...quantities.keys()] }, active: true },
        select: { id: true, name: true, price: true, categoryId: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      const lines = [...quantities].map(([productId, quantity]) => {
        const product = byId.get(productId);
        if (!product) throw new OrderError(m.unavailable);
        return { productId, name: product.name, unitPrice: product.price, quantity, lineTotal: product.price * quantity };
      });

      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      if (subtotal < settings.minOrder) throw new OrderError(m.minOrder(formatMoney(settings.minOrder)));
      const deliveryFee = deliveryFeeFor(settings, subtotal, input.deliveryType);
      // Promociones vigentes (las mismas que vio el cliente en la cotización).
      const promos = await evaluatePromotions(
        {
          lines: lines.map((l) => ({ productId: l.productId, categoryId: byId.get(l.productId)?.categoryId ?? null, lineTotal: l.lineTotal })),
          paymentMethod: input.paymentMethod,
          deliveryType: input.deliveryType,
        },
        tx,
      );
      const total = subtotal - promos.discount + deliveryFee;

      // Cliente por teléfono: la web y WhatsApp comparten el mismo registro.
      const key = phoneKey(input.phone);
      const customer = key.length === 10
        ? await tx.customer.upsert({
            where: { phoneKey: key },
            update: input.waId ? { waId: input.waId } : {},
            create: { phoneKey: key, waId: input.waId ?? "", name: input.customerName },
          })
        : null;
      if (customer && !customer.name) {
        await tx.customer.update({ where: { id: customer.id }, data: { name: input.customerName } });
      }
      const address = input.address.trim();
      if (customer && input.deliveryType === "DELIVERY") {
        await tx.customerAddress.upsert({
          where: { customerId_address: { customerId: customer.id, address } },
          update: { lastUsedAt: new Date() },
          create: { customerId: customer.id, address },
        });
      }

      const order = await tx.order.create({
        data: {
          publicToken: randomBytes(18).toString("base64url"),
          channel: input.channel,
          customerName: input.customerName,
          phone: input.phone.replace(/\D/g, ""), // solo dígitos, para emparejarlo con WhatsApp
          deliveryType: input.deliveryType,
          address: input.deliveryType === "DELIVERY" ? address : "",
          recipientName: input.recipientName?.trim() ?? "",
          locale,
          customerId: customer?.id,
          notes: input.notes,
          paymentMethod: input.paymentMethod,
          cashGivenWith: input.paymentMethod === "CASH" ? input.cashGivenWith : null,
          subtotal,
          discount: promos.discount,
          discountDetail: promos.applied.length ? JSON.stringify(promos.applied.map((a) => ({ name: a.name, nameEn: a.nameEn, amount: a.amount }))) : "",
          deliveryFee,
          total,
          items: { create: lines },
        },
        select: { id: true, publicToken: true, locale: true, total: true, subtotal: true, discount: true, deliveryFee: true },
      });

      for (const line of lines) {
        await changeStock(tx, {
          productId: line.productId,
          change: -line.quantity,
          reason: "SALE",
          note: `Pedido #${order.id}`,
          orderId: order.id,
        });
      }
      return order;
    });
  } catch (e) {
    if (e instanceof InventoryError && e.product) {
      const name = pick(locale, e.product.name, e.product.nameEn);
      throw new OrderError(e.product.stock > 0 ? m.onlyLeft(e.product.stock, name) : m.soldOut(name));
    }
    if (e instanceof InventoryError) throw new OrderError(e.message);
    throw e;
  }
}

/** Enlace público para que el cliente vea su pedido. Requiere SITE_URL para enlaces fuera del sitio (WhatsApp). */
export function orderTrackingUrl(order: { id: number; publicToken: string; locale?: string }) {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const lang: Locale = order.locale === "en" ? "en" : "es";
  return `${base}${localePath(lang, `/pedido/${order.id}`)}?t=${order.publicToken}`;
}
