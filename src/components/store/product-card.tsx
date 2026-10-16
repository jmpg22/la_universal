"use client";

import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import type { StoreProduct } from "@/lib/store-data";
import { useOrderChat } from "./order-chat-context";

const TINTS = ["bg-amber-50", "bg-emerald-50", "bg-sky-50", "bg-rose-50", "bg-lime-50", "bg-orange-50", "bg-teal-50", "bg-violet-50"];

function Badge({ product }: { product: StoreProduct }) {
  const { t } = useI18n();
  const onSale = product.compareAtPrice != null && product.compareAtPrice > product.price;
  if (product.stock <= 0)
    return <span className="rounded-full bg-stone-800/85 px-2.5 py-1 text-xs font-bold text-white">{t.product.soldOut}</span>;
  if (onSale) {
    const pct = Math.round((1 - product.price / product.compareAtPrice!) * 100);
    return <span className="rounded-full bg-coral-500 px-2.5 py-1 text-xs font-extrabold text-white shadow-sm">−{pct}%</span>;
  }
  if (product.stock <= 3)
    return <span className="rounded-full bg-sun-400 px-2.5 py-1 text-xs font-bold text-brand-950">{t.product.lastUnits}</span>;
  return null;
}

/** Botón "Agregar" que se convierte en − 2 + cuando el producto ya está en el pedido. */
function AddButton({ product }: { product: StoreProduct }) {
  const { t } = useI18n();
  const { qtyOf, setQty } = useOrderChat();
  const qty = qtyOf(product.id);

  if (product.stock <= 0) {
    return (
      <button type="button" disabled className="btn w-full rounded-full bg-stone-100 text-stone-400">
        {t.product.soldOut}
      </button>
    );
  }
  if (qty > 0) {
    return (
      <div className="flex animate-pop items-center justify-between rounded-full bg-brand-600 p-1 text-white shadow-md shadow-brand-700/20">
        <button
          type="button"
          onClick={() => setQty(product.id, qty - 1)}
          aria-label={`${t.product.removeOne}: ${product.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold hover:bg-white/15"
        >
          −
        </button>
        <span className="font-display text-lg font-bold tabular-nums" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQty(product.id, qty + 1)}
          disabled={qty >= product.stock}
          aria-label={`${t.product.addOne}: ${product.name}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold hover:bg-white/15 disabled:opacity-40"
        >
          +
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setQty(product.id, 1)}
      className="btn w-full rounded-full bg-brand-50 py-2.5 text-brand-700 ring-1 ring-brand-200 ring-inset hover:bg-brand-600 hover:text-white"
    >
      <span aria-hidden className="text-base">＋</span> {t.shop.add}
    </button>
  );
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const onSale = product.compareAtPrice != null && product.compareAtPrice > product.price;
  const soldOut = product.stock <= 0;
  return (
    <article
      id={`p-${product.slug}`}
      className="group flex flex-col rounded-3xl bg-white p-2 shadow-sm ring-1 ring-black/5 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/5"
    >
      <div className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl ${TINTS[product.id % TINTS.length]}`}>
        {product.imageUrl ? (
          // Las fotos pueden venir de /uploads o de una URL externa.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${soldOut ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <span
            role="img"
            aria-label={product.name}
            className={`text-6xl drop-shadow-sm transition duration-300 group-hover:scale-110 group-hover:-rotate-6 sm:text-7xl ${soldOut ? "opacity-40 grayscale" : ""}`}
          >
            {product.category?.emoji ?? "🛒"}
          </span>
        )}
        <div className="absolute top-2 left-2">
          <Badge product={product} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-1.5 pt-3 pb-1.5">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-bold text-stone-800">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5">
          <span className={`font-display text-2xl font-bold tabular-nums ${onSale ? "text-coral-600" : "text-stone-900"}`}>
            {formatMoney(product.price)}
          </span>
          <span className="text-xs text-stone-500">/ {product.unit}</span>
          {onSale && <span className="w-full text-xs text-stone-400 line-through">{formatMoney(product.compareAtPrice!)}</span>}
        </div>
        <AddButton product={product} />
      </div>
    </article>
  );
}
