"use client";

import { useActionState, useState } from "react";
import { recordMovement } from "@/actions/admin/inventory";
import { FormMessage } from "@/components/admin/ui";

type ProductOption = { id: number; name: string; stock: number; category: string };

export function MovementForm({ products, defaultProductId }: { products: ProductOption[]; defaultProductId?: number }) {
  const [state, action, pending] = useActionState(recordMovement, undefined);
  const [productId, setProductId] = useState(defaultProductId ? String(defaultProductId) : "");
  const [kind, setKind] = useState("entrada");
  const selected = products.find((p) => String(p.id) === productId);

  const groups = Map.groupBy(products, (p) => p.category);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="productId" className="label">Producto</label>
          <select id="productId" name="productId" required value={productId} onChange={(e) => setProductId(e.target.value)} className="input">
            <option value="">Elige un producto…</option>
            {[...groups].map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (hay {p.stock})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kind" className="label">Tipo de movimiento</label>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="input">
            <option value="entrada">➕ Entrada de mercancía</option>
            <option value="salida">➖ Merma / salida</option>
            <option value="conteo">🔢 Conteo físico (fijar existencia)</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div>
          <label htmlFor="quantity" className="label">{kind === "conteo" ? "Existencia contada" : "Cantidad"}</label>
          <input id="quantity" name="quantity" type="number" min={0} step={1} required className="input" />
          {selected && <p className="mt-1 text-xs text-stone-500">Existencia actual: {selected.stock}</p>}
        </div>
        <div>
          <label htmlFor="note" className="label">Nota (opcional)</label>
          <input id="note" name="note" className="input" placeholder={kind === "entrada" ? "Ej. Proveedor, factura…" : "Ej. caducado, roto…"} />
        </div>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Guardando…" : "Registrar movimiento"}
      </button>
    </form>
  );
}
