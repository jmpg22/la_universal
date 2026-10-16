"use client";

import { useActionState } from "react";
import { saveCategory } from "@/actions/admin/categories";

type Category = { id: number; name: string; nameEn: string; emoji: string; sortOrder: number; active: boolean };

/** Formulario de una categoría: sirve para crear (sin `category`) o editar. */
export function CategoryForm({ category, productCount, deleteSlot }: { category?: Category; productCount?: number; deleteSlot?: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2" key={category ? undefined : state?.ok}>
        {category && <input type="hidden" name="id" value={category.id} />}
        <input name="emoji" defaultValue={category?.emoji ?? "🛒"} aria-label="Emoji" className="input w-14 text-center text-lg" />
        <input name="name" defaultValue={category?.name} required placeholder="Nombre de la categoría" aria-label="Nombre" className="input min-w-40 flex-1" />
        <input name="nameEn" defaultValue={category?.nameEn} placeholder="🇺🇸 En inglés (automático si vacío)" aria-label="Nombre en inglés" className="input min-w-40 flex-1" />
        <input name="sortOrder" type="number" min={0} defaultValue={category?.sortOrder ?? 0} aria-label="Orden" title="Orden (menor primero)" className="input w-20" />
        {category && (
          <label className="flex items-center gap-1.5 text-sm font-semibold text-stone-600">
            <input type="checkbox" name="active" defaultChecked={category.active} className="accent-brand-600" /> Visible
          </label>
        )}
        <button type="submit" disabled={pending} className={`btn ${category ? "btn-secondary" : "btn-primary"}`}>
          {pending ? "…" : category ? "Guardar" : "＋ Agregar"}
        </button>
        {category && <span className="text-xs text-stone-500">{productCount} productos</span>}
        {state?.error && <span className="text-sm font-semibold text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-sm font-semibold text-brand-700">✓ {state.ok}</span>}
      </form>
      {deleteSlot}
    </div>
  );
}
