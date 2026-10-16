"use client";

import { useActionState, useState } from "react";
import { addCashMovement, closeCash, openCash } from "@/actions/admin/cash";
import { FormMessage } from "@/components/admin/ui";
import { formatMoney, parseMoney } from "@/lib/format";

export function OpenCashForm() {
  const [state, action, pending] = useActionState(openCash, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="openingCash" className="label">Fondo inicial (efectivo con el que empiezas)</label>
        <div className="flex gap-2">
          <span className="flex items-center text-lg font-bold text-stone-500">$</span>
          <input id="openingCash" name="openingCash" inputMode="decimal" required defaultValue="0" className="input max-w-40 text-lg font-bold" />
        </div>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary px-6 py-3 text-base">
        {pending ? "Abriendo…" : "🔓 Abrir caja"}
      </button>
    </form>
  );
}

const QUICK_OUT = ["Pago a proveedor", "Retiro de efectivo", "Gasto de la tienda", "Cambio a otra caja"];
const QUICK_IN = ["Cambio / morralla", "Aporte del dueño", "Cobro pendiente"];

export function MovementForm() {
  const [state, action, pending] = useActionState(addCashMovement, undefined);
  const [kind, setKind] = useState<"IN" | "OUT">("OUT");
  const [reason, setReason] = useState("");
  return (
    <form action={action} key={state?.ok} className="space-y-3">
      <div className="flex rounded-xl bg-stone-100 p-1">
        {(
          [
            ["OUT", "➖ Salida de efectivo"],
            ["IN", "➕ Entrada de efectivo"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex-1 cursor-pointer">
            <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="peer sr-only" />
            <span className="block rounded-lg px-3 py-2 text-center text-sm font-bold text-stone-500 peer-checked:bg-white peer-checked:text-stone-900 peer-checked:shadow-sm">
              {label}
            </span>
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
        <input name="amount" inputMode="decimal" required placeholder="$ Monto" aria-label="Monto" className="input text-base font-bold" />
        <input name="reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" className="input" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(kind === "OUT" ? QUICK_OUT : QUICK_IN).map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-200">
            {r}
          </button>
        ))}
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-secondary w-full">
        {pending ? "Guardando…" : "Registrar movimiento"}
      </button>
    </form>
  );
}

export function CloseCashForm({ expectedCash }: { expectedCash: number }) {
  const [state, action, pending] = useActionState(closeCash, undefined);
  const [counted, setCounted] = useState("");
  const countedCents = parseMoney(counted);
  const diff = countedCents == null ? null : countedCents - expectedCash;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("¿Hacer el corte y cerrar la caja? Ya no se podrá modificar.")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="countedCash" className="label">¿Cuánto efectivo contaste en la caja?</label>
        <div className="flex gap-2">
          <span className="flex items-center text-lg font-bold text-stone-500">$</span>
          <input
            id="countedCash"
            name="countedCash"
            inputMode="decimal"
            required
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="input max-w-48 text-xl font-bold"
            placeholder="0.00"
          />
        </div>
      </div>
      {diff != null && (
        <p
          className={`rounded-xl px-4 py-3 text-lg font-extrabold ${
            diff === 0 ? "bg-brand-50 text-brand-800" : diff > 0 ? "bg-sky-50 text-sky-800" : "bg-red-50 text-red-700"
          }`}
        >
          {diff === 0 ? "✅ Cuadra exacto" : diff > 0 ? `Sobran ${formatMoney(diff)}` : `Faltan ${formatMoney(-diff)}`}
        </p>
      )}
      <div>
        <label htmlFor="notes" className="label">Notas (opcional)</label>
        <textarea id="notes" name="notes" rows={2} className="input" placeholder="Ej. faltante por cambio mal dado, se dejó $500 de fondo…" />
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn w-full bg-stone-900 py-3 text-base text-white hover:bg-stone-800">
        {pending ? "Cerrando…" : "🧾 Hacer corte y cerrar caja"}
      </button>
    </form>
  );
}
