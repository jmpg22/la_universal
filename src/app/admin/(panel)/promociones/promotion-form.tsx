"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { savePromotion } from "@/actions/admin/promotions";
import { FormMessage } from "@/components/admin/ui";
import { centsToInput } from "@/lib/format";

export type PromotionValues = {
  id: number;
  name: string;
  nameEn: string;
  active: boolean;
  kind: string;
  value: number;
  paymentMethods: string;
  deliveryType: string;
  minSubtotal: number;
  categoryId: number | null;
  weekdays: string;
};

const PAYMENTS = [
  ["CASH", "💵 Efectivo"],
  ["CARD", "💳 Tarjeta"],
  ["TRANSFER", "📲 Transferencia"],
] as const;
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function Chip({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-block rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 ring-1 ring-stone-300 transition peer-checked:bg-brand-600 peer-checked:text-white peer-checked:ring-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400">
        {label}
      </span>
    </label>
  );
}

export function PromotionForm({ promotion, categories }: { promotion?: PromotionValues; categories: { id: number; name: string; emoji: string }[] }) {
  const [state, action, pending] = useActionState(savePromotion, undefined);
  const [kind, setKind] = useState(promotion?.kind ?? "PERCENT");
  const methods = (promotion?.paymentMethods ?? "").split(",").filter(Boolean);
  const days = (promotion?.weekdays ?? "").split(",").filter(Boolean).map(Number);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="card space-y-5 p-5"
    >
      {promotion && <input type="hidden" name="id" value={promotion.id} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold">{promotion ? "Editar promoción" : "Nueva promoción"}</h2>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" name="active" defaultChecked={promotion?.active ?? true} className="h-4 w-4 accent-brand-600" /> Activa
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">Nombre que ve el cliente</label>
          <input id="name" name="name" required defaultValue={promotion?.name} className="input" placeholder="Ej. 15% pagando con tarjeta o transferencia" />
        </div>
        <div>
          <label htmlFor="nameEn" className="label">En inglés (opcional)</label>
          <input id="nameEn" name="nameEn" defaultValue={promotion?.nameEn} className="input" placeholder="Se traduce solo si lo dejas vacío" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Descuento</legend>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-stone-100 p-1">
            {(
              [
                ["PERCENT", "Porcentaje %"],
                ["FIXED", "Monto fijo $"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="peer sr-only" />
                <span className="block rounded-lg px-3 py-1.5 text-sm font-bold text-stone-500 peer-checked:bg-white peer-checked:text-stone-900 peer-checked:shadow-sm">
                  {label}
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {kind === "FIXED" && <span className="font-bold text-stone-500">$</span>}
            <input
              name="value"
              required
              inputMode="decimal"
              defaultValue={promotion ? (promotion.kind === "FIXED" ? centsToInput(promotion.value) : String(promotion.value)) : "15"}
              className="input w-28 text-lg font-bold"
              aria-label={kind === "PERCENT" ? "Porcentaje" : "Monto en pesos"}
            />
            {kind === "PERCENT" && <span className="font-bold text-stone-500">%</span>}
          </div>
        </div>
      </fieldset>

      <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200">
        <p className="mb-3 text-sm font-bold text-stone-700">Condiciones <span className="font-normal text-stone-500">(deja vacío lo que no importe)</span></p>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-stone-600">Solo pagando con</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENTS.map(([value, label]) => (
                <Chip key={value} name="paymentMethods" value={value} label={label} checked={methods.includes(value)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-stone-600">Solo estos días</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((label, d) => (
                <Chip key={d} name="weekdays" value={String(d)} label={label} checked={days.includes(d)} />
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="categoryId" className="label">Solo en la categoría</label>
              <select id="categoryId" name="categoryId" defaultValue={promotion?.categoryId ?? ""} className="input">
                <option value="">Toda la tienda</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="deliveryType" className="label">Solo para</label>
              <select id="deliveryType" name="deliveryType" defaultValue={promotion?.deliveryType ?? ""} className="input">
                <option value="">Recoger o envío</option>
                <option value="PICKUP">Recoger en tienda</option>
                <option value="DELIVERY">Envío a domicilio</option>
              </select>
            </div>
            <div>
              <label htmlFor="minSubtotal" className="label">Compra mínima ($)</label>
              <input id="minSubtotal" name="minSubtotal" inputMode="decimal" defaultValue={promotion?.minSubtotal ? centsToInput(promotion.minSubtotal) : ""} className="input" placeholder="Sin mínimo" />
            </div>
          </div>
        </div>
      </div>

      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Guardando…" : "Guardar promoción"}
        </button>
        {promotion && (
          <Link href="/admin/promociones" className="btn btn-secondary">
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
