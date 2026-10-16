"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { changeStock, InventoryError } from "@/lib/inventory";
import { TAG } from "@/lib/store-data";

export type MovementState = { error?: string; ok?: string } | undefined;

const schema = z.object({
  productId: z.coerce.number().int().positive("Elige un producto"),
  kind: z.enum(["entrada", "salida", "conteo"]),
  quantity: z.coerce.number().int("Usa números enteros").min(0).max(1000000),
  note: z.string().trim().max(200),
});

export async function recordMovement(_prev: MovementState, formData: FormData): Promise<MovementState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    productId: formData.get("productId"),
    kind: formData.get("kind"),
    quantity: formData.get("quantity"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { productId, kind, quantity, note } = parsed.data;
  if (kind !== "conteo" && quantity === 0) return { error: "La cantidad debe ser mayor a cero." };

  try {
    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { name: true, stock: true } });
      // "conteo" fija la existencia al número contado físicamente.
      const change = kind === "entrada" ? quantity : kind === "salida" ? -quantity : quantity - product.stock;
      if (change === 0) return { name: product.name, stock: product.stock, change };
      const stock = await changeStock(tx, {
        productId,
        change,
        reason: kind === "entrada" ? "RESTOCK" : "ADJUSTMENT",
        note: note || (kind === "conteo" ? "Conteo físico" : kind === "salida" ? "Merma / salida" : "Entrada de mercancía"),
      });
      return { name: product.name, stock, change };
    });
    updateTag(TAG.products);
    refresh();
    if (result.change === 0) return { ok: `“${result.name}” ya tenía ${result.stock}; no hubo cambios.` };
    return { ok: `“${result.name}”: ${result.change > 0 ? "+" : ""}${result.change} → ahora hay ${result.stock}.` };
  } catch (e) {
    if (e instanceof InventoryError) return { error: e.message };
    throw e;
  }
}
