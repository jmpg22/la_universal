import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProduct } from "@/actions/admin/products";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { STOCK_REASON_LABEL, formatDateTime } from "@/lib/format";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: PageProps<"/admin/productos/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [product, categories, movements, soldUnits] = await Promise.all([
    db.product.findUnique({ where: { id } }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, emoji: true } }),
    db.stockMovement.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.orderItem.aggregate({ where: { productId: id, order: { status: { not: "CANCELLED" } } }, _sum: { quantity: true } }),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        description={`Vendidos en total: ${soldUnits._sum.quantity ?? 0} · Creado ${formatDateTime(product.createdAt)}`}
        actions={
          product.active && (
            <Link href={`/productos/${product.slug}`} target="_blank" className="btn btn-secondary">
              Ver en la tienda ↗
            </Link>
          )
        }
      />
      <ProductForm product={product} categories={categories} />

      <section className="card mt-8 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-extrabold">Últimos movimientos de inventario</h2>
          <Link href={`/admin/inventario?producto=${product.id}`} className="text-sm font-bold text-brand-700 hover:underline">
            Ver todos / registrar entrada →
          </Link>
        </div>
        {movements.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-stone-500">Sin movimientos.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2 text-stone-500">{formatDateTime(m.createdAt)}</td>
                  <td className="px-5 py-2">{STOCK_REASON_LABEL[m.reason]}</td>
                  <td className="px-5 py-2 text-stone-500">{m.note}</td>
                  <td className={`px-5 py-2 text-right font-bold tabular-nums ${m.change > 0 ? "text-brand-700" : "text-red-600"}`}>
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </td>
                  <td className="px-5 py-2 text-right text-stone-500 tabular-nums">→ {m.stockAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card mt-8 flex flex-wrap items-center justify-between gap-3 p-5 ring-red-100">
        <div>
          <h2 className="font-extrabold text-red-700">Eliminar producto</h2>
          <p className="text-sm text-stone-500">
            Los pedidos anteriores conservan su registro. Si solo quieres que no aparezca, desmarca “Visible en la tienda”.
          </p>
        </div>
        <form action={deleteProduct.bind(null, product.id)}>
          <ConfirmButton message={`¿Eliminar "${product.name}" definitivamente?`}>Eliminar</ConfirmButton>
        </form>
      </section>
    </>
  );
}
