import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CHANNEL_LABEL, DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, addDays, formatDateTime, startOfLocalDay } from "@/lib/format";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || !(await db.adminUser.findUnique({ where: { id: session.uid }, select: { id: true } }))) {
    return new Response("No autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("desde") ?? "";
  const to = url.searchParams.get("hasta") ?? "";
  const channel = url.searchParams.get("canal");
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return new Response("Fechas no válidas", { status: 400 });

  const orders = await db.order.findMany({
    where: {
      createdAt: { gte: startOfLocalDay(from), lt: startOfLocalDay(addDays(to, 1)) },
      ...(channel === "ONLINE" || channel === "COUNTER" || channel === "WHATSAPP" ? { channel } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { items: true },
  });

  const header = ["Pedido", "Fecha", "Canal", "Estado", "Cliente", "Teléfono", "Entrega", "Pago", "Productos", "Subtotal", "Envío", "Total"];
  const rows = orders.map((o) => [
    o.id,
    formatDateTime(o.createdAt),
    CHANNEL_LABEL[o.channel],
    STATUS_LABEL[o.status],
    o.customerName,
    o.phone,
    DELIVERY_LABEL[o.deliveryType],
    PAYMENT_LABEL[o.paymentMethod],
    o.items.map((i) => `${i.quantity} x ${i.name}`).join("; "),
    (o.subtotal / 100).toFixed(2),
    (o.deliveryFee / 100).toFixed(2),
    (o.total / 100).toFixed(2),
  ]);
  // BOM para que Excel respete los acentos.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ventas-${from}-a-${to}.csv"`,
    },
  });
}
