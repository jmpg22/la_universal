"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  type ChatMessage,
  type ChatState,
  cancelChatOrder,
  confirmChatOrder,
  getChatState,
  sendChatMessage,
  setOrderItem,
} from "@/actions/chat";
import { useI18n } from "@/lib/i18n/client";
import type { BankInfo } from "./bank-details";

export type CatalogItem = { id: number; name: string; price: number; unit: string; emoji: string; imageUrl: string | null; stock: number };

type OrderChatContextValue = {
  state: ChatState | null;
  open: boolean;
  sending: boolean;
  busy: boolean;
  error: string;
  storeName: string;
  bank: BankInfo;
  catalog: Map<number, CatalogItem>;
  count: number;
  subtotal: number;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  inputHint: string;
  qtyOf: (productId: number) => number;
  openChat: (opts?: { focus?: boolean; hint?: string }) => void;
  closeChat: () => void;
  send: (text: string) => Promise<boolean>;
  setQty: (productId: number, quantity: number) => void;
  confirm: (signature: string) => Promise<void>;
  cancel: () => Promise<void>;
};

const TOKEN_KEY = "la-universal-pedido";
const OrderChatContext = createContext<OrderChatContextValue | null>(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // sin almacenamiento: el pedido dura lo que la pestaña
  }
}

export function OrderChatProvider({
  children,
  storeName,
  bank,
  products,
}: {
  children: React.ReactNode;
  storeName: string;
  bank: BankInfo;
  products: CatalogItem[];
}) {
  const { lang, t } = useI18n();
  const [state, setState] = useState<ChatState | null>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inputHint, setInputHint] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const catalog = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const apply = useCallback((next: ChatState | null | undefined) => {
    if (!next) return;
    tokenRef.current = next.token;
    saveToken(next.token);
    setState(next);
  }, []);

  // ?pedido=1 en la URL (p. ej. desde las direcciones viejas /carrito o /checkout) abre el chat.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("pedido") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la URL solo se puede leer en el navegador
    setOpen(true);
    url.searchParams.delete("pedido");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  // Al cargar: recuperar el pedido en curso de este navegador.
  useEffect(() => {
    const token = readToken();
    if (!token) return;
    tokenRef.current = token;
    getChatState(token)
      .then((s) => {
        if (s) setState(s);
        else {
          tokenRef.current = null;
          saveToken(null);
        }
      })
      .catch(() => {});
  }, []);

  // Con el chat abierto se revisa cada poco si la tienda contestó.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      if (!tokenRef.current || sending || busy || document.visibilityState !== "visible") return;
      getChatState(tokenRef.current)
        .then((s) => {
          if (s) setState((prev) => (prev && prev.messages.length === s.messages.length && prev.humanHandling === s.humanHandling ? prev : s));
        })
        .catch(() => {});
    }, 7000);
    return () => clearInterval(id);
  }, [open, sending, busy]);

  // Escape cierra; en celular se bloquea el scroll de la página mientras el chat ocupa la pantalla.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const small = window.matchMedia("(max-width: 639px)").matches;
    if (small) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const openChat = useCallback((opts?: { focus?: boolean; hint?: string }) => {
    setOpen(true);
    setInputHint(opts?.hint ?? "");
    if (opts?.focus !== false) setTimeout(() => inputRef.current?.focus(), 250);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || sending) return false;
      setError("");
      setSending(true);
      setInputHint("");
      // Se muestra de inmediato el mensaje del cliente mientras el asistente contesta.
      const optimistic: ChatMessage = { id: -Date.now(), from: "customer", text: clean, meta: null };
      setState((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, optimistic] }
          : { token: "", messages: [optimistic], items: [], subtotal: 0, humanHandling: false },
      );
      try {
        const result = await sendChatMessage({ token: tokenRef.current, text: clean, lang });
        if (result.ok) apply(result.state);
        else {
          if (result.state) apply(result.state);
          else setState((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev));
          setError(result.error || t.chat.error);
          return false;
        }
        return true;
      } catch {
        setState((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev));
        setError(t.chat.error);
        return false;
      } finally {
        setSending(false);
      }
    },
    [sending, lang, apply, t],
  );

  const setQty = useCallback(
    (productId: number, quantity: number) => {
      // Cambio inmediato en pantalla; el servidor confirma después.
      setState((prev) => {
        const base = prev ?? { token: "", messages: [], items: [], subtotal: 0, humanHandling: false };
        const exists = base.items.some((i) => i.productId === productId);
        const items =
          quantity <= 0
            ? base.items.filter((i) => i.productId !== productId)
            : exists
              ? base.items.map((i) => (i.productId === productId ? { ...i, quantity } : i))
              : [...base.items, { productId, quantity }];
        const subtotal = items.reduce((s, i) => s + (catalog.get(i.productId)?.price ?? 0) * i.quantity, 0);
        return { ...base, items, subtotal };
      });
      setOrderItem({ token: tokenRef.current, productId, quantity, lang })
        .then((r) => (r.ok ? apply(r.state) : r.error && setError(r.error)))
        .catch(() => setError(t.chat.error));
    },
    [catalog, lang, apply, t],
  );

  const confirm = useCallback(
    async (signature: string) => {
      setBusy(true);
      setError("");
      try {
        const r = await confirmChatOrder({ token: tokenRef.current, signature, lang });
        if (r.ok) apply(r.state);
        else {
          if (r.state) apply(r.state);
          if (r.error) setError(r.error);
        }
      } catch {
        setError(t.chat.error);
      } finally {
        setBusy(false);
      }
    },
    [lang, apply, t],
  );

  const cancel = useCallback(async () => {
    setBusy(true);
    try {
      const r = await cancelChatOrder({ token: tokenRef.current, lang });
      if (r.ok) apply(r.state);
    } catch {
      setError(t.chat.error);
    } finally {
      setBusy(false);
    }
  }, [lang, apply, t]);

  const value = useMemo<OrderChatContextValue>(() => {
    const items = state?.items ?? [];
    return {
      state,
      open,
      sending,
      busy,
      error,
      storeName,
      bank,
      catalog,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: state?.subtotal ?? 0,
      inputRef,
      inputHint,
      qtyOf: (productId) => items.find((i) => i.productId === productId)?.quantity ?? 0,
      openChat,
      closeChat: () => setOpen(false),
      send,
      setQty,
      confirm,
      cancel,
    };
  }, [state, open, sending, busy, error, storeName, bank, catalog, inputHint, openChat, send, setQty, confirm, cancel]);

  return <OrderChatContext value={value}>{children}</OrderChatContext>;
}

export function useOrderChat() {
  const ctx = useContext(OrderChatContext);
  if (!ctx) throw new Error("useOrderChat debe usarse dentro de <OrderChatProvider>");
  return ctx;
}
