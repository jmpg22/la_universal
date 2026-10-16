import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { StockReason } from "@/generated/prisma/enums";

/** Falta de existencia. Trae el producto para poder armar el mensaje en el idioma del cliente. */
export class InventoryError extends Error {
  constructor(
    message: string,
    readonly product?: { name: string; nameEn: string; stock: number },
  ) {
    super(message);
  }
}

/**
 * Cambia el stock de un producto y deja registro del movimiento.
 * Las salidas fallan si no hay suficiente existencia (la condición va en el mismo UPDATE para evitar carreras).
 */
export async function changeStock(
  tx: Prisma.TransactionClient,
  input: { productId: number; change: number; reason: StockReason; note?: string; orderId?: number; allowNegative?: boolean },
) {
  const { productId, change, reason, note = "", orderId, allowNegative = false } = input;
  const guard = change < 0 && !allowNegative ? { stock: { gte: -change } } : {};
  const updated = await tx.product.updateMany({
    where: { id: productId, ...guard },
    data: { stock: { increment: change } },
  });
  const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true, nameEn: true, stock: true } });
  if (!product) throw new InventoryError("El producto ya no existe.");
  if (updated.count === 0) {
    throw new InventoryError(
      product.stock > 0 ? `Solo quedan ${product.stock} de "${product.name}".` : `"${product.name}" está agotado.`,
      product,
    );
  }
  await tx.stockMovement.create({
    data: { productId, change, stockAfter: product.stock, reason, note, orderId },
  });
  return product.stock;
}
