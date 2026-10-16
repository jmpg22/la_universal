import type { Metadata } from "next";
import Link from "next/link";
import { deletePromotion, togglePromotion } from "@/actions/admin/promotions";
import { ConfirmButton, SubmitButton } from "@/components/admin/confirm-button";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { describePromotion } from "@/lib/promotions";
import { PromotionForm } from "./promotion-form";

export const metadata: Metadata = { title: "Promociones" };

export default async function PromotionsPage({ searchParams }: PageProps<"/admin/promociones">) {
  await requireAdmin();
  const params = await searchParams;
  const editId = Number(params.editar) || undefined;
  const savedId = Number(params.guardado) || undefined;

  const [promotions, categories, discounted] = await Promise.all([
    db.promotion.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }], include: { category: { select: { name: true } } } }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, emoji: true } }),
    db.order.aggregate({ where: { discount: { gt: 0 }, status: { not: "CANCELLED" } }, _sum: { discount: true }, _count: true }),
  ]);
  const editing = editId ? promotions.find((p) => p.id === editId) : undefined;

  return (
    <>
      <PageHeader
        title="Promociones"
        description="Descuentos que se aplican solos en las cotizaciones del chat, en WhatsApp y en los pedidos. Puedes activarlas, cambiarlas o crear nuevas."
      />

      {savedId && (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Promoción guardada. Ya se aplica en los pedidos nuevos.
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="space-y-3">
          <p className="text-sm text-stone-500">
            Pedidos con promoción: <span className="font-bold text-stone-800">{discounted._count}</span> · Descuento total dado:{" "}
            <span className="font-bold text-stone-800">{formatMoney(discounted._sum.discount ?? 0)}</span>
          </p>
          {promotions.length === 0 ? (
            <EmptyState icon="🏷️" title="Aún no hay promociones">
              Crea la primera con el formulario.
            </EmptyState>
          ) : (
            promotions.map((p) => (
              <article key={p.id} className={`card p-4 ${p.active ? "" : "opacity-60"} ${p.id === editId ? "ring-2 ring-brand-400" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${p.active ? "bg-coral-100 text-coral-600" : "bg-stone-100 text-stone-500"}`}>
                    {p.kind === "FIXED" ? "$" : `${p.value}%`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-stone-900">{p.name}</p>
                    <p className="text-sm text-stone-500">{describePromotion(p)}</p>
                    {p.nameEn && <p className="mt-0.5 text-xs text-stone-400">🇺🇸 {p.nameEn}</p>}
                  </div>
                  <form action={togglePromotion.bind(null, p.id)}>
                    <SubmitButton
                      className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${p.active ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-stone-100 text-stone-500 ring-stone-300"}`}
                    >
                      {p.active ? "Activa" : "Pausada"}
                    </SubmitButton>
                  </form>
                </div>
                <div className="mt-3 flex gap-3 border-t border-stone-100 pt-3 text-sm">
                  <Link href={`/admin/promociones?editar=${p.id}`} className="font-bold text-brand-700 hover:underline">
                    Editar
                  </Link>
                  <form action={deletePromotion.bind(null, p.id)} className="ml-auto">
                    <ConfirmButton className="font-bold text-red-600 hover:underline" message={`¿Eliminar la promoción "${p.name}"?`}>
                      Eliminar
                    </ConfirmButton>
                  </form>
                </div>
              </article>
            ))
          )}
        </section>

        <PromotionForm key={editing?.id ?? "nueva"} promotion={editing} categories={categories} />
      </div>
    </>
  );
}
