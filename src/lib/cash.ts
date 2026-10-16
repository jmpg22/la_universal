import "server-only";
import { db } from "@/lib/db";

// Corte de caja. Una venta entra a la caja cuando se entrega (ahí se cobra): pedidos en línea al
// marcarlos "Entregado" y ventas de mostrador al registrarlas.

export async function getOpenSession() {
  return db.cashSession.findFirst({
    where: { closedAt: null },
    orderBy: { openedAt: "desc" },
    include: { movements: { orderBy: { createdAt: "asc" } } },
  });
}

export async function sessionSummary(session: { openedAt: Date; closedAt: Date | null; openingCash: number; movements: { kind: string; amount: number }[] }) {
  const until = session.closedAt ?? new Date();
  const orders = await db.order.findMany({
    where: { status: { not: "CANCELLED" }, deliveredAt: { gte: session.openedAt, lte: until } },
    orderBy: { deliveredAt: "asc" },
    select: {
      id: true,
      channel: true,
      customerName: true,
      paymentMethod: true,
      total: true,
      discount: true,
      deliveredAt: true,
      items: { select: { name: true, quantity: true, lineTotal: true } },
    },
  });

  const byMethod = { CASH: 0, CARD: 0, TRANSFER: 0 } as Record<"CASH" | "CARD" | "TRANSFER", number>;
  const countByMethod = { CASH: 0, CARD: 0, TRANSFER: 0 } as Record<"CASH" | "CARD" | "TRANSFER", number>;
  for (const o of orders) {
    byMethod[o.paymentMethod] += o.total;
    countByMethod[o.paymentMethod] += 1;
  }
  const cashIn = session.movements.filter((m) => m.kind === "IN").reduce((s, m) => s + m.amount, 0);
  const cashOut = session.movements.filter((m) => m.kind === "OUT").reduce((s, m) => s + m.amount, 0);

  const products = new Map<string, { name: string; quantity: number; total: number }>();
  for (const item of orders.flatMap((o) => o.items)) {
    const row = products.get(item.name) ?? { name: item.name, quantity: 0, total: 0 };
    row.quantity += item.quantity;
    row.total += item.lineTotal;
    products.set(item.name, row);
  }

  return {
    orders,
    count: orders.length,
    total: orders.reduce((s, o) => s + o.total, 0),
    discounts: orders.reduce((s, o) => s + o.discount, 0),
    byMethod,
    countByMethod,
    cashIn,
    cashOut,
    expectedCash: session.openingCash + byMethod.CASH + cashIn - cashOut,
    topProducts: [...products.values()].sort((a, b) => b.total - a.total),
  };
}

/** Pedidos en línea que siguen sin entregarse (no entran al corte hasta que se entreguen). */
export async function pendingDeliveries() {
  return db.order.aggregate({
    where: { status: { in: ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"] } },
    _count: true,
    _sum: { total: true },
  });
}
