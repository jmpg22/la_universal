"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { OrderStatus } from "@/generated/prisma/enums";
import { changeStock } from "@/lib/inventory";
import { TAG } from "@/lib/store-data";
import { notifyOrderStatus } from "@/lib/whatsapp/notify";

const STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];

export async function setOrderStatus(orderId: number, status: OrderStatus) {
  await requireAdmin();
  if (!STATUSES.includes(status)) throw new Error("Estado no válido");

  const changed = await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status === status) return false;
    // Un pedido cancelado ya devolvió su mercancía; no se reabre para no descuadrar el inventario.
    if (order.status === "CANCELLED") throw new Error("El pedido ya está cancelado.");

    // La fecha de entrega es cuando se cobra: es la que usa el corte de caja.
    const deliveredAt = status === "DELIVERED" ? new Date() : order.status === "DELIVERED" ? null : undefined;
    await tx.order.update({ where: { id: orderId }, data: { status, deliveredAt } });

    if (status === "CANCELLED") {
      for (const item of order.items) {
        if (!item.productId) continue; // el producto se eliminó
        await changeStock(tx, {
          productId: item.productId,
          change: item.quantity,
          reason: "CANCEL",
          note: `Pedido #${order.id} cancelado`,
          orderId: order.id,
        });
      }
    }
    return true;
  });

  if (status === "CANCELLED") updateTag(TAG.products);
  if (changed) after(() => notifyOrderStatus(orderId));
  refresh();
}
