"use server";

import { randomBytes } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { changeStock } from "@/lib/inventory";
import { TAG } from "@/lib/store-data";

const saleSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(9999) })).min(1),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER"]),
  cashGivenWith: z.number().int().min(0).nullable(),
  customerName: z.string().trim().max(80),
});

export type CounterSaleResult = { ok: true; orderId: number; total: number } | { ok: false; error: string };

/** Registra una venta hecha en la tienda física: queda como pedido entregado y descuenta inventario. */
export async function registerCounterSale(input: z.input<typeof saleSchema>): Promise<CounterSaleResult> {
  await requireAdmin();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Agrega al menos un producto." };
  const { items, paymentMethod, cashGivenWith, customerName } = parsed.data;

  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, name: true, price: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items.flatMap(({ productId, quantity }) => {
    const p = byId.get(productId);
    return p ? [{ productId, name: p.name, unitPrice: p.price, quantity, lineTotal: p.price * quantity }] : [];
  });
  if (lines.length !== items.length) return { ok: false, error: "Un producto ya no existe. Recarga la página." };
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  if (paymentMethod === "CASH" && cashGivenWith != null && cashGivenWith < total) {
    return { ok: false, error: "El efectivo recibido es menor al total." };
  }

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        publicToken: randomBytes(18).toString("base64url"),
        channel: "COUNTER",
        status: "DELIVERED",
        deliveredAt: new Date(),
        customerName: customerName || "Venta de mostrador",
        paymentMethod,
        cashGivenWith,
        subtotal: total,
        total,
        items: { create: lines },
      },
    });
    for (const line of lines) {
      // La mercancía está físicamente en mostrador, así que se permite vender aunque el sistema marque 0.
      await changeStock(tx, {
        productId: line.productId,
        change: -line.quantity,
        reason: "SALE",
        note: `Mostrador #${created.id}`,
        orderId: created.id,
        allowNegative: true,
      });
    }
    return created;
  });

  updateTag(TAG.products);
  refresh();
  return { ok: true, orderId: order.id, total };
}
