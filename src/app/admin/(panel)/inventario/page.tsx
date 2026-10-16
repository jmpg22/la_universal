import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { STOCK_REASON_LABEL, formatDateTime, formatMoney } from "@/lib/format";
import { MovementForm } from "./movement-form";

export const metadata: Metadata = { title: "Inventario" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventario">) {
  await requireAdmin();
  const params = await searchParams;
  const productId = Number(params.producto) || undefined;

  const [products, movements] = await Promise.all([
    db.product.findMany({ orderBy: { name: "asc" }, include: { category: true } }),
    db.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { product: { select: { id: true, name: true } } },
    }),
  ]);

  const lowStock = products
    .filter((p) => p.active && p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock);
  const inventoryValue = products.reduce((sum, p) => sum + Math.max(0, p.stock) * p.price, 0);
  const filteredProduct = products.find((p) => p.id === productId);

  return (
    <>
      <PageHeader title="Inventario" description={`Valor del inventario a precio de venta: ${formatMoney(inventoryValue)}`} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <h2 className="mb-4 font-extrabold">Registrar movimiento</h2>
          <MovementForm
            key={productId}
            defaultProductId={productId}
            products={products.map((p) => ({ id: p.id, name: p.name, stock: p.stock, category: p.category?.name ?? "Sin categoría" }))}
          />
        </section>

        <section className="card overflow-hidden">
          <h2 className="px-5 pt-4 pb-2 font-extrabold">
            Por surtir <span className="text-sm font-semibold text-stone-500">({lowStock.length})</span>
          </h2>
          {lowStock.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-stone-500">Todo surtido 👌</p>
          ) : (
            <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2 text-sm">
                  <Link href={`/admin/inventario?producto=${p.id}`} className="font-semibold text-stone-800 hover:text-brand-700">
                    {p.name}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.stock <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {p.stock <= 0 ? "Agotado" : `Quedan ${p.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">
            Historial {filteredProduct && <>de “{filteredProduct.name}”</>}
          </h2>
          {filteredProduct && (
            <Link href="/admin/inventario" className="text-sm font-bold text-brand-700 hover:underline">
              Ver todos los productos
            </Link>
          )}
        </div>
        {movements.length === 0 ? (
          <EmptyState icon="📋" title="Sin movimientos todavía" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-stone-50 text-left text-xs font-bold tracking-wide text-stone-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Nota</th>
                  <th className="px-4 py-3 text-right">Cambio</th>
                  <th className="px-4 py-3 text-right">Queda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-stone-500">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-2 font-semibold">
                      <Link href={`/admin/inventario?producto=${m.product.id}`} className="hover:text-brand-700">
                        {m.product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{STOCK_REASON_LABEL[m.reason]}</td>
                    <td className="px-4 py-2 text-stone-500">
                      {m.orderId ? (
                        <Link href={`/admin/pedidos/${m.orderId}`} className="hover:text-brand-700">
                          {m.note}
                        </Link>
                      ) : (
                        m.note
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right font-bold tabular-nums ${m.change > 0 ? "text-brand-700" : "text-red-600"}`}>
                      {m.change > 0 ? `+${m.change}` : m.change}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.stockAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
