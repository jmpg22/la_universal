import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { toggleProductActive } from "@/actions/admin/products";
import { SubmitButton } from "@/components/admin/confirm-button";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { ProductImage } from "@/components/store/product-image";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Productos" };

const FILTERS = {
  todos: "Todos",
  activos: "Visibles",
  ocultos: "Ocultos",
  bajo: "Stock bajo",
  agotados: "Agotados",
} as const;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/productos">) {
  await requireAdmin();
  const params = await searchParams;
  const q = one(params.q)?.trim() ?? "";
  const categoryId = Number(one(params.categoria)) || undefined;
  const filter = (one(params.estado) ?? "todos") as keyof typeof FILTERS;

  const where: Prisma.ProductWhereInput = {
    ...(categoryId && { categoryId }),
    ...(q && { OR: [{ name: { contains: q } }, { sku: { contains: q } }] }),
    ...(filter === "activos" && { active: true }),
    ...(filter === "ocultos" && { active: false }),
    ...(filter === "agotados" && { stock: { lte: 0 } }),
  };

  const [allMatching, categories] = await Promise.all([
    db.product.findMany({ where, orderBy: { name: "asc" }, include: { category: true } }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  // "Stock bajo" compara contra el umbral de cada producto.
  const products =
    filter === "bajo" ? allMatching.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold) : allMatching;

  const saved = one(params.guardado);
  const deleted = one(params.eliminado);
  const filterHref = (key: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (categoryId) sp.set("categoria", String(categoryId));
    if (key !== "todos") sp.set("estado", key);
    return `/admin/productos${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Productos"
        description={`${products.length} productos`}
        actions={
          <Link href="/admin/productos/nuevo" className="btn btn-primary">
            ＋ Nuevo producto
          </Link>
        }
      />

      {(saved || deleted) && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          {saved ? `Se guardó “${saved}”.` : `Se eliminó “${deleted}”.`}
        </p>
      )}

      <div className="card mb-4 space-y-3 p-4">
        <Form action="/admin/productos" className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Buscar por nombre o código" className="input max-w-xs flex-1" />
          <select name="categoria" defaultValue={categoryId ?? ""} className="input w-auto">
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
          {filter !== "todos" && <input type="hidden" name="estado" value={filter} />}
          <button type="submit" className="btn btn-secondary">
            Buscar
          </button>
        </Form>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FILTERS).map(([key, label]) => (
            <Link
              key={key}
              href={filterHref(key)}
              className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${
                filter === key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState icon="📦" title="No hay productos con esos filtros" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-stone-50 text-left text-xs font-bold tracking-wide text-stone-500 uppercase">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3">Visible</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((p) => {
                const low = p.stock > 0 && p.stock <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className={p.active ? "" : "bg-stone-50 text-stone-500"}>
                    <td className="px-4 py-2">
                      <Link href={`/admin/productos/${p.id}`} className="flex items-center gap-3 font-bold text-stone-800 hover:text-brand-700">
                        <ProductImage name={p.name} imageUrl={p.imageUrl} emoji={p.category?.emoji} seed={p.id} className="h-10 w-10 shrink-0 rounded-lg" emojiClassName="text-xl" />
                        <span>
                          {p.name}
                          {p.featured && <span className="ml-1 text-amber-500" title="Destacado">★</span>}
                          {p.sku && <span className="block text-xs font-normal text-stone-400">{p.sku}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2">{p.category ? `${p.category.emoji} ${p.category.name}` : "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {formatMoney(p.price)}
                      <span className="block text-xs font-normal text-stone-400">/ {p.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold tabular-nums ${
                          p.stock <= 0 ? "bg-red-100 text-red-700" : low ? "bg-amber-100 text-amber-800" : "text-stone-800"
                        }`}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <form action={toggleProductActive.bind(null, p.id)}>
                        <SubmitButton className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${p.active ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-stone-100 text-stone-500 ring-stone-300"}`}>
                          {p.active ? "Sí" : "No"}
                        </SubmitButton>
                      </form>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/admin/productos/${p.id}`} className="font-bold text-brand-700 hover:underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
