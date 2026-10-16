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

export type PeriodKey = "hoy" | "semana" | "mes";

function weekdayOf(key: string) {
  // 0 = domingo, en la zona horaria de la tienda.
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: TIME_ZONE }).format(startOfLocalDay(key));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Rango del periodo y el periodo anterior equivalente, para comparar. */
export function periodRange(period: PeriodKey, today = todayKey()) {
  if (period === "hoy") {
    const y = addDays(today, -1);
    return { from: today, to: today, prevFrom: y, prevTo: y, label: "Hoy", prevLabel: "ayer" };
  }
  if (period === "semana") {
    const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
    return {
      from: monday,
      to: today,
      prevFrom: addDays(monday, -7),
      prevTo: addDays(today, -7),
      label: "Esta semana",
      prevLabel: "los mismos días de la semana pasada",
    };
  }
  const [y, m, d] = today.split("-").map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${y}-${pad(m)}-01`,
    to: today,
    prevFrom: `${py}-${pad(pm)}-01`,
    prevTo: `${py}-${pad(pm)}-${pad(Math.min(d, daysInMonth(py, pm)))}`,
    label: "Este mes",
    prevLabel: "los mismos días del mes pasado",
  };
}

/** Rendimiento de cada producto en un rango: lo más vendido, lo que se vende poco y lo que no se vende. */
export async function productPerformance(fromKey: string, toKey: string) {
  const [products, items, lastSales] = await Promise.all([
    db.product.findMany({
      select: { id: true, name: true, stock: true, price: true, active: true, unit: true, category: { select: { name: true, emoji: true } } },
    }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: { status: { not: "CANCELLED" }, createdAt: { gte: startOfLocalDay(fromKey), lt: startOfLocalDay(addDays(toKey, 1)) } },
      },
      _sum: { quantity: true, lineTotal: true },
      _count: { orderId: true },
    }),
    // Última venta de cada producto (de todos los tiempos).
    db.$queryRawUnsafe<{ productId: number; lastSold: string }[]>(
      `SELECT oi.productId AS productId, MAX(o.createdAt) AS lastSold
       FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId
       WHERE oi.productId IS NOT NULL AND o.status <> 'CANCELLED'
       GROUP BY oi.productId`,
    ),
  ]);
  const sold = new Map(items.map((i) => [i.productId!, { units: i._sum.quantity ?? 0, revenue: i._sum.lineTotal ?? 0, orders: i._count.orderId }]));
  const last = new Map(lastSales.map((r) => [Number(r.productId), r.lastSold ? new Date(r.lastSold) : null]));

  return products.map((p) => ({
    ...p,
    units: sold.get(p.id)?.units ?? 0,
    revenue: sold.get(p.id)?.revenue ?? 0,
    orders: sold.get(p.id)?.orders ?? 0,
    lastSold: last.get(p.id) ?? null,
  }));
}
