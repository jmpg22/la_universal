"use client";

import Link from "next/link";
import type { Quote } from "@/lib/chat/quote";
import { formatMoney } from "@/lib/format";
import { localePath, pick } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { unitLabel } from "@/lib/i18n/dictionaries";
import { BankDetails } from "./bank-details";
import { useOrderChat } from "./order-chat-context";

/** Texto del asistente con *negritas*, saltos de línea y enlaces. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block min-h-[0.5em]">
          {line.split(/(\*[^*\n]+\*|https?:\/\/\S+)/g).map((part, j) => {
            if (/^\*[^*]+\*$/.test(part)) return <strong key={j}>{part.slice(1, -1)}</strong>;
            if (/^https?:\/\//.test(part))
              return (
                <a key={j} href={part} target="_blank" rel="noreferrer" className="break-all underline">
                  {part}
                </a>
              );
            return part;
          })}
        </span>
      ))}
    </>
  );
}

export function QuoteCard({ quote, active }: { quote: Quote; active: boolean }) {
  const { lang, t } = useI18n();
  const { confirm, cancel, busy, openChat } = useOrderChat();
  // Cotizaciones guardadas antes de existir las promociones no traen estos campos.
  const discounts = quote.discounts ?? [];
  const suggestions = quote.suggestions ?? [];
  const discount = quote.discount ?? 0;
  const belowMin = quote.minOrder > quote.subtotal;
  const canConfirm = active && quote.missing.length === 0 && !belowMin && !busy;

  return (
    <div
      className={`w-full animate-rise overflow-hidden rounded-3xl bg-white shadow-md ring-1 transition ${
        active ? "ring-brand-200" : "opacity-60 ring-stone-200"
      }`}
    >
      <div className={`flex items-center justify-between px-4 py-3 ${active ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600"}`}>
        <p className="font-display text-lg font-semibold">🧾 {active ? t.chat.quoteTitle : t.chat.quoteOld}</p>
        <p className="font-display text-lg font-bold tabular-nums">{formatMoney(quote.total)}</p>
      </div>

      <ul className="divide-y divide-stone-100 px-4">
        {quote.items.map((i) => (
          <li key={i.productId} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span className="text-stone-700">
              <span className="font-extrabold text-stone-900">{i.quantity} ×</span> {pick(lang, i.name, i.nameEn)}
              <span className="block text-xs text-stone-400">
                {formatMoney(i.unitPrice)} / {unitLabel(t, i.unit)}
              </span>
            </span>
            <span className="font-bold whitespace-nowrap tabular-nums">{formatMoney(i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-1 border-t border-dashed border-stone-200 px-4 py-3 text-sm">
        <div className="flex justify-between text-stone-600">
          <dt>{t.chat.subtotal}</dt>
          <dd className="tabular-nums">{formatMoney(quote.subtotal)}</dd>
        </div>
        {discounts.map((d) => (
          <div key={d.id} className="flex justify-between gap-3 font-semibold text-coral-600">
            <dt>🎁 {pick(lang, d.name, d.nameEn)}</dt>
            <dd className="whitespace-nowrap tabular-nums">−{formatMoney(d.amount)}</dd>
          </div>
        ))}
        {quote.deliveryType === "DELIVERY" && (
          <div className="flex justify-between text-stone-600">
            <dt>{t.chat.shipping}</dt>
            <dd className="tabular-nums">{quote.deliveryFee === 0 ? t.chat.free : formatMoney(quote.deliveryFee)}</dd>
          </div>
        )}
        <div className="flex justify-between pt-1 font-display text-xl font-bold text-stone-900">
          <dt>{t.chat.total}</dt>
          <dd className="tabular-nums">{formatMoney(quote.total)}</dd>
        </div>
      </dl>

      <div className="space-y-1 bg-stone-50 px-4 py-3 text-xs text-stone-600">
        {quote.customerName && (
          <p>
            👤 {t.chat.customer}: <span className="font-semibold text-stone-800">{quote.customerName}</span>
            {quote.phone && ` · ${quote.phone}`}
          </p>
        )}
        {quote.deliveryType && (
          <p>
            {quote.deliveryType === "DELIVERY" ? "🛵" : "🏪"} <span className="font-semibold text-stone-800">{t.delivery[quote.deliveryType]}</span>
            {quote.address && ` · ${quote.address}`}
          </p>
        )}
        {quote.recipientName && (
          <p>
            🙋 {t.chat.receiving}: <span className="font-semibold text-stone-800">{quote.recipientName}</span>
          </p>
        )}
        {quote.paymentMethod && (
          <p>
            💳 <span className="font-semibold text-stone-800">{t.payment[quote.paymentMethod]}</span>
            {quote.cashGivenWith ? ` · ${t.chat.payWith(formatMoney(quote.cashGivenWith))}` : ""}
          </p>
        )}
      </div>

      {active && discount > 0 && (
        <p className="mx-4 rounded-xl bg-coral-100 px-3 py-2 text-center text-sm font-bold text-coral-600">
          🎉 {t.chat.savings} {formatMoney(discount)}
        </p>
      )}
      {active && suggestions.length > 0 && (
        <p className="mx-4 mt-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-100">
          {t.chat.suggestion(
            [...new Set(suggestions.flatMap((s) => s.paymentMethods))].map((m) => t.payment[m as keyof typeof t.payment] ?? m).join(" / "),
            formatMoney(suggestions.reduce((sum, s) => sum + s.amount, 0)),
          )}
        </p>
      )}
      {active && (quote.missing.length > 0 || belowMin) && (
        <div className="mx-4 mt-3 rounded-xl bg-sun-100 px-3 py-2 text-xs text-amber-900">
          {belowMin && <p className="font-semibold">{t.chat.belowMin(formatMoney(quote.minOrder))}</p>}
          {quote.missing.length > 0 && (
            <p>
              <span className="font-semibold">{t.chat.missingTitle}</span> {quote.missing.map((m) => t.chat.missing[m]).join(", ")}
            </p>
          )}
        </div>
      )}

      {active && (
        <div className="grid gap-2 p-4">
          <button type="button" disabled={!canConfirm} onClick={() => confirm(quote.signature)} className="btn btn-primary w-full py-3 text-base">
            {busy ? t.chat.confirming : `✅ ${t.chat.confirm}`}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => openChat({ hint: t.chat.changePlaceholder })} className="btn btn-secondary">
              ✏️ {t.chat.change}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => window.confirm(t.chat.confirmCancel) && cancel()}
              className="btn btn-danger"
            >
              {t.chat.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrderDoneCard({ order }: { order: { id: number; publicToken: string; total: number; paymentMethod: string } }) {
  const { lang, t } = useI18n();
  const { bank, openChat } = useOrderChat();
  return (
    <div className="w-full animate-pop space-y-3 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-500 p-5 text-white shadow-lg">
      <p className="text-4xl" aria-hidden>
        🎉
      </p>
      <div>
        <p className="font-display text-2xl font-bold">{t.chat.doneTitle(order.id)}</p>
        <p className="text-brand-50">{t.chat.doneText}</p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums">
          {t.chat.total}: {formatMoney(order.total)}
        </p>
      </div>
      {order.paymentMethod === "TRANSFER" && (
        <div className="text-stone-800">
          <BankDetails bank={bank} total={formatMoney(order.total)} orderId={order.id} />
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href={`${localePath(lang, `/pedido/${order.id}`)}?t=${order.publicToken}`} className="btn btn-sun">
          {t.chat.track} →
        </Link>
        <button type="button" onClick={() => openChat()} className="btn bg-white/15 text-white ring-1 ring-white/40 hover:bg-white/25">
          {t.chat.newOrder}
        </button>
      </div>
    </div>
  );
}
