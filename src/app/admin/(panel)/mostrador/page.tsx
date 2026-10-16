import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PointOfSale } from "./point-of-sale";

export const metadata: Metadata = { title: "Venta de mostrador" };

export default async function CounterPage() {
  await requireAdmin();
  const products = await db.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true, stock: true, sku: true, unit: true, category: { select: { emoji: true } } },
  });
  return (
    <>
      <PageHeader title="Venta de mostrador" description="Registra las ventas de la tienda física para llevar el inventario y las ventas al día." />
      <PointOfSale
        products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, sku: p.sku, unit: p.unit, emoji: p.category?.emoji ?? "🛒" }))}
      />
    </>
  );
}
