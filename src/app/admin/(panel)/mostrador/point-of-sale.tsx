"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { registerCounterSale } from "@/actions/admin/pos";
import { formatMoney, parseMoney } from "@/lib/format";

type PosProduct = { id: number; name: string; price: number; stock: number; sku: string | null; unit: string; emoji: string };
type Line = { product: PosProduct; quantity: number };

function normalize(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function PointOfSale({ products }: { products: PosProduct[] }) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [payment, setPayment] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [cash, setCash] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string; orderId?: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return products.filter((p) => words.every((w) => normalize(`${p.name} ${p.sku ?? ""}`).includes(w))).slice(0, 8);
  }, [query, products]);

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  const cashCents = parseMoney(cash);
  const change = cashCents != null ? cashCents - total : null;

  function addProduct(product: PosProduct) {
    setMessage(null);
    setLines((current) => {
      const found = current.find((l) => l.product.id === product.id);
      return found
        ? current.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...current, { product, quantity: 1 }];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function setQty(id: number, quantity: number) {
    setLines((current) => (quantity <= 0 ? current.filter((l) => l.product.id !== id) : current.map((l) => (l.product.id === id ? { ...l, quantity } : l))));
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // Un lector de código de barras escribe el código y presiona Enter.
    const exact = products.find((p) => p.sku && p.sku.toLowerCase() === query.trim().toLowerCase());
    const pick = exact ?? (results.length === 1 ? results[0] : null);
    if (pick) addProduct(pick);
  }

  function charge() {
    startTransition(async () => {
      const result = await registerCounterSale({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
        paymentMethod: payment,
        cashGivenWith: payment === "CASH" ? cashCents : null,
        customerName: "",
      });
      if (result.ok) {
        setMessage({
          type: "ok",
          orderId: result.orderId,
          text: `Venta #${result.orderId} registrada por ${formatMoney(result.total)}${change != null && change > 0 ? ` · cambio ${formatMoney(change)}` : ""}.`,
        });
        setLines([]);
        setCash("");
        setPayment("CASH");
        searchRef.current?.focus();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="card relative p-4">
          <label htmlFor="pos-search" className="label">Buscar producto o escanear código</label>
          <input
            id="pos-search"
            ref={searchRef}
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Escribe el nombre o escanea…"
            className="input text-base"
          />
          {results.length > 0 && (
            <ul className="absolute right-4 left-4 z-10 mt-1 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-stone-200">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => addProduct(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-50">
                    <span aria-hidden>{p.emoji}</span>
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className={`text-xs ${p.stock <= 0 ? "text-red-600" : "text-stone-500"}`}>hay {p.stock}</span>
                    <span className="font-bold tabular-nums">{formatMoney(p.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          {lines.length === 0 ? (
            <p className="px-5 py-12 text-center text-stone-500">Agrega productos para empezar la venta.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lines.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl" aria-hidden>
                    {product.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{product.name}</p>
                    <p className="text-xs text-stone-500">
                      {formatMoney(product.price)} / {product.unit}
                      {quantity > product.stock && <span className="ml-2 font-semibold text-amber-700">· El sistema marca {product.stock} en stock</span>}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => setQty(product.id, Math.floor(Number(e.target.value)))}
                    aria-label={`Cantidad de ${product.name}`}
                    className="input w-20 text-center"
                  />
                  <p className="w-24 text-right font-extrabold tabular-nums">{formatMoney(product.price * quantity)}</p>
                  <button type="button" onClick={() => setQty(product.id, 0)} aria-label={`Quitar ${product.name}`} className="rounded-lg px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="card space-y-4 p-5 lg:sticky lg:top-6">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold">Total</span>
          <span className="text-4xl font-extrabold tabular-nums">{formatMoney(total)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["CASH", "💵 Efectivo"],
              ["CARD", "💳 Tarjeta"],
              ["TRANSFER", "📲 Transf."],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPayment(value)}
              className={`rounded-xl px-2 py-2 text-sm font-bold ring-1 ${payment === value ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-stone-200"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {payment === "CASH" && (
          <div>
            <label htmlFor="cash" className="label">Recibido</label>
            <input id="cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0.00" className="input text-lg" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[50, 100, 200, 500].map((v) => (
                <button key={v} type="button" onClick={() => setCash(String(v))} className="rounded-lg bg-stone-100 px-2.5 py-1 text-sm font-bold hover:bg-stone-200">
                  ${v}
                </button>
              ))}
            </div>
            {change != null && total > 0 && (
              <p className={`mt-3 text-lg font-extrabold ${change < 0 ? "text-red-600" : "text-brand-700"}`}>
                {change < 0 ? `Faltan ${formatMoney(-change)}` : `Cambio: ${formatMoney(change)}`}
              </p>
            )}
          </div>
        )}
        {message && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm font-semibold ${message.type === "ok" ? "bg-brand-50 text-brand-800" : "bg-red-50 text-red-700"}`}>
            {message.text}{" "}
            {message.orderId && (
              <Link href={`/admin/pedidos/${message.orderId}`} className="underline">
                Ver ticket
              </Link>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={charge}
          disabled={pending || lines.length === 0 || (payment === "CASH" && change != null && change < 0)}
          className="btn btn-primary w-full py-4 text-lg"
        >
          {pending ? "Registrando…" : `Cobrar ${formatMoney(total)}`}
        </button>
        {lines.length > 0 && (
          <button type="button" onClick={() => setLines([])} className="w-full text-sm font-semibold text-stone-500 hover:text-red-600">
            Cancelar venta
          </button>
        )}
      </aside>
    </div>
  );
}
