import type { Metadata } from "next";
import { deleteCategory } from "@/actions/admin/categories";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CategoryForm } from "./category-row";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  await requireAdmin();
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader title="Categorías" description="Organizan el catálogo y el menú de la tienda. El número de orden define cuál aparece primero." />
      <section className="card mb-6">
        <h2 className="px-4 pt-4 font-extrabold">Nueva categoría</h2>
        <CategoryForm />
      </section>
      <section className="card divide-y divide-stone-100">
        {categories.map((c) => (
          <CategoryForm
            key={c.id}
            category={c}
            productCount={c._count.products}
            deleteSlot={
              <form action={deleteCategory.bind(null, c.id)}>
                <ConfirmButton
                  className="btn btn-danger px-3"
                  message={`¿Eliminar "${c.name}"? Sus ${c._count.products} productos quedarán sin categoría.`}
                >
                  Eliminar
                </ConfirmButton>
              </form>
            }
          />
        ))}
      </section>
    </>
  );
}
