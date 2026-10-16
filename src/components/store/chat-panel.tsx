"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { OrderDoneCard, QuoteCard, RichText } from "./chat-cards";
import { useOrderChat } from "./order-chat-context";

function Avatar({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-sun-400 shadow-inner ${small ? "h-8 w-8 text-base" : "h-11 w-11 text-2xl"}`}
      aria-hidden
    >
      🛒
    </span>
  );
}

function Typing() {
  const { t } = useI18n();
  return (
    <div className="flex items-end gap-2" aria-live="polite">
      <Avatar small />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm" aria-label={t.chat.typing}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

/** Lista de lo que lleva hasta ahora (lo agregado con los botones del catálogo o por el asistente). */
function CurrentOrder() {
  const { t } = useI18n();
  const { state, catalog, setQty, subtotal } = useOrderChat();
  const [expanded, setExpanded] = useState(false);
  const items = state?.items ?? [];
  if (items.length === 0) return null;
  return (
    <div className="border-t border-stone-200 bg-white/90 px-4 py-2 backdrop-blur">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between text-sm" aria-expanded={expanded}>
        <span className="font-bold text-stone-800">
          🧺 {t.chat.currentOrder} · {t.chat.fabItems(items.reduce((n, i) => n + i.quantity, 0))}
        </span>
        <span className="flex items-center gap-2 font-extrabold text-brand-700 tabular-nums">
          {formatMoney(subtotal)} <span className={`transition ${expanded ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>
      {expanded && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
          {items.map((i) => {
            const p = catalog.get(i.productId);
            return (
              <li key={i.productId} className="flex items-center gap-2">
                <span className="flex-1 truncate text-stone-700">
                  {p?.emoji} {p?.name ?? `#${i.productId}`}
                </span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => setQty(i.productId, i.quantity - 1)} className="h-7 w-7 rounded-full bg-stone-100 font-bold hover:bg-stone-200" aria-label="−">
                    −
                  </button>
                  <span className="w-6 text-center font-bold tabular-nums">{i.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQty(i.productId, i.quantity + 1)}
                    disabled={p ? i.quantity >= p.stock : false}
                    className="h-7 w-7 rounded-full bg-stone-100 font-bold hover:bg-stone-200 disabled:opacity-30"
                    aria-label="+"
                  >
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ChatPanel() {
  const { t } = useI18n();
  const { state, open, closeChat, send, sending, error, storeName, welcome, inputRef, inputHint } = useOrderChat();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = state?.messages ?? [];
  const hasCustomerMessages = messages.some((m) => m.from === "customer");

  // La cotización vigente es la última, mientras no haya un pedido confirmado o cancelado después.
  let activeQuoteId = -1;
  for (const m of messages) {
    if (m.meta?.type === "quote") activeQuoteId = m.id;
    if (m.meta?.type === "order" || m.meta?.type === "cancelled") activeQuoteId = -1;
  }

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, open]);

  // El textarea crece con el texto (hasta 5 líneas).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text, inputRef]);

  async function submit() {
    const value = text;
    if (!value.trim()) return;
    setText("");
    const ok = await send(value);
    if (!ok) setText(value);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.chat.title}
      aria-hidden={!open}
      inert={!open}
      className={`fixed z-50 flex flex-col overflow-hidden bg-cream shadow-2xl transition duration-300 ease-out
        inset-0 sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(720px,calc(100dvh-2.5rem))] sm:w-[420px] sm:rounded-[2rem] sm:ring-1 sm:ring-black/5
        ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"}`}
    >
      <header className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-br from-brand-700 to-brand-500 px-4 pt-[max(env(safe-area-inset-top),0.875rem)] pb-3.5 text-white">
        <span className="absolute -top-10 -right-6 h-28 w-28 rounded-full bg-white/10" aria-hidden />
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-tight font-semibold">{t.chat.title}</p>
          <p className="flex items-center gap-1.5 text-xs text-brand-100">
            <span className="h-2 w-2 rounded-full bg-sun-400" aria-hidden />
            {state?.humanHandling ? t.chat.subtitleHuman : t.chat.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={closeChat}
          aria-label={t.chat.close}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl hover:bg-white/25"
        >
          ✕
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [background-image:radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.05)_1px,transparent_0)] [background-size:18px_18px]"
      >
        <div className="flex items-end gap-2">
          <Avatar small />
          <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[15px] leading-relaxed text-stone-800 shadow-sm">
            {welcome.trim() || t.chat.welcome(storeName)}
          </div>
        </div>

        {!hasCustomerMessages && (
          <div className="space-y-2 pl-10">
            <p className="text-xs font-semibold text-stone-500">{t.chat.examplesTitle}</p>
            <div className="flex flex-wrap gap-2">
              {t.chat.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setText(ex);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full bg-white px-3 py-1.5 text-left text-sm text-brand-800 shadow-sm ring-1 ring-brand-200 transition hover:-translate-y-0.5 hover:bg-brand-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          if (m.from === "customer") {
            return (
              <div key={m.id} className="flex animate-rise justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-white shadow-sm">
                  {m.text}
                </div>
              </div>
            );
          }
          if (m.from === "system") {
            if (m.meta?.type === "order") return <OrderDoneCard key={m.id} order={m.meta.order} />;
            if (m.meta?.type === "quote") return <QuoteCard key={m.id} quote={m.meta.quote} active={m.id === activeQuoteId} />;
            return (
              <p key={m.id} className="mx-auto w-fit rounded-full bg-stone-200/70 px-3 py-1 text-center text-xs font-semibold text-stone-600">
                {m.meta?.type === "cancelled" ? t.chat.cancelled : m.text}
              </p>
            );
          }
          return (
            <div key={m.id} className="animate-rise space-y-2">
              {m.text && (
                <div className="flex items-end gap-2">
                  <Avatar small />
                  <div
                    className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-relaxed text-stone-800 shadow-sm ${
                      m.from === "staff" ? "bg-sun-100 ring-1 ring-sun-300" : "bg-white"
                    }`}
                  >
                    {m.from === "staff" && <p className="mb-0.5 text-xs font-bold text-amber-800">{t.chat.store}</p>}
                    <RichText text={m.text} />
                  </div>
                </div>
              )}
              {m.meta?.type === "quote" && <QuoteCard quote={m.meta.quote} active={m.id === activeQuoteId} />}
              {m.meta?.type === "order" && <OrderDoneCard order={m.meta.order} />}
            </div>
          );
        })}

        {sending && <Typing />}
      </div>

      <CurrentOrder />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="border-t border-stone-200 bg-white px-3 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        {error && (
          <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            {t.chat.placeholder}
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={inputHint || t.chat.placeholder}
            maxLength={1000}
            className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border-0 bg-stone-100 px-4 py-3 text-[15px] text-stone-800 placeholder:text-stone-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label={t.chat.send}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700 active:scale-95 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
              <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

/** Botón flotante para abrir el chat; muestra lo que lleva el pedido. */
export function OrderFab() {
  const { t } = useI18n();
  const { open, openChat, count, subtotal } = useOrderChat();
  return (
    <button
      type="button"
      onClick={() => openChat()}
      aria-label={t.chat.open}
      className={`fixed right-4 bottom-[max(env(safe-area-inset-bottom),1rem)] left-4 z-40 flex items-center justify-center gap-3 rounded-full bg-brand-600 px-5 py-4 text-white shadow-xl shadow-brand-900/30 ring-4 ring-white/70 transition duration-300 hover:bg-brand-700 active:scale-[0.98]
        sm:right-6 sm:bottom-6 sm:left-auto sm:px-6
        ${open ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"}`}
    >
      <span className="relative text-2xl" aria-hidden>
        💬
        {count > 0 && (
          <span className="absolute -top-2 -right-3 flex h-5 min-w-5 animate-pop items-center justify-center rounded-full bg-sun-400 px-1 text-xs font-extrabold text-brand-950">
            {count}
          </span>
        )}
      </span>
      <span className="font-display text-lg font-semibold">{t.chat.fab}</span>
      {count > 0 && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-bold tabular-nums">{formatMoney(subtotal)}</span>}
    </button>
  );
}
