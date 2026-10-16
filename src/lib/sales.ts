import "server-only";
import { db } from "@/lib/db";
import type { OrderChannel, PaymentMethod } from "@/generated/prisma/enums";
import { addDays, localDateKey, startOfLocalDay, TIME_ZONE } from "@/lib/format";

/** Reporte de ventas (pedidos no cancelados) entre dos fechas locales, ambas incluidas. */
export async function salesReport(fromKey: string, toKey: string, channel?: OrderChannel) {
  const orders = await db.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      createdAt: { gte: startOfLocalDay(fromKey), lt: startOfLocalDay(addDays(toKey, 1)) },
      ...(channel && { channel }),
    },
    select: {
      id: true,
      total: true,
      deliveryFee: true,
      channel: true,
      paymentMethod: true,
      createdAt: true,
      items: { select: { productId: true, name: true, quantity: true, lineTotal: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const total = orders.reduce((s, o) => s + o.total, 0);

  // Ventas por día, incluyendo días sin ventas para que la gráfica no salte fechas.
  const byDay = new Map<string, { total: number; count: number }>();
  for (let key = fromKey; key <= toKey; key = addDays(key, 1)) byDay.set(key, { total: 0, count: 0 });
  for (const o of orders) {
    const day = byDay.get(localDateKey(o.createdAt));
    if (day) {
      day.total += o.total;
      day.count += 1;
    }
  }

  const byPayment = new Map<PaymentMethod, { total: number; count: number }>();
  const byChannel = new Map<OrderChannel, { total: number; count: number }>();
  for (const o of orders) {
    const p = byPayment.get(o.paymentMethod) ?? { total: 0, count: 0 };
    p.total += o.total;
    p.count += 1;
    byPayment.set(o.paymentMethod, p);
    const c = byChannel.get(o.channel) ?? { total: 0, count: 0 };
    c.total += o.total;
    c.count += 1;
    byChannel.set(o.channel, c);
  }

  const products = new Map<string, { productId: number | null; name: string; quantity: number; total: number }>();
  for (const item of orders.flatMap((o) => o.items)) {
    const key = item.productId ? `id:${item.productId}` : `name:${item.name}`;
    const row = products.get(key) ?? { productId: item.productId, name: item.name, quantity: 0, total: 0 };
    row.quantity += item.quantity;
    row.total += item.lineTotal;
    products.set(key, row);
  }

  // Ventas por hora del día: útil para saber cuándo hay más movimiento.
  const hourFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE });
  const byHour = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
  for (const o of orders) {
    const h = Number(hourFmt.format(o.createdAt)) % 24;
    byHour[h].total += o.total;
    byHour[h].count += 1;
  }

  return {
    orders,
    total,
    count: orders.length,
    average: orders.length ? Math.round(total / orders.length) : 0,
    deliveryFees: orders.reduce((s, o) => s + o.deliveryFee, 0),
    byDay: [...byDay].map(([key, v]) => ({ key, ...v })),
    byPayment,
    byChannel,
    byHour,
    topProducts: [...products.values()].sort((a, b) => b.total - a.total),
  };
}

export function todayKey() {
  return localDateKey(new Date());
}

const dayLabel = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: TIME_ZONE });
const weekdayLabel = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", timeZone: TIME_ZONE });

export function shortDay(key: string) {
  return dayLabel.format(startOfLocalDay(key));
}

export function weekdayDay(key: string) {
  return weekdayLabel.format(startOfLocalDay(key));
}
