"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { confirmConversationOrder } from "@/lib/chat/confirm";
import { type Draft, type Quote, computeQuote, parseDraft } from "@/lib/chat/quote";
import { db } from "@/lib/db";
import { type Locale, isLocale } from "@/lib/i18n/config";
import { processConversation } from "@/lib/whatsapp/bot";
import { deliver } from "@/lib/whatsapp/conversations";
import { recordInbound } from "@/lib/whatsapp/inbound";

// Chat de pedidos de la página web. Cada navegador tiene una llave secreta (token) que identifica su conversación.

export type ChatMessage = {
  id: number;
  from: "customer" | "bot" | "staff" | "system";
  text: string;
  meta: { type: "quote"; quote: Quote } | { type: "order"; order: { id: number; publicToken: string; total: number; paymentMethod: string; locale: string } } | { type: "cancelled" } | { type: "added"; productId: number; quantity: number } | null;
};

export type ChatState = {
  token: string;
  messages: ChatMessage[];
  /** Pedido en curso: lo que muestran los botones del catálogo y el botón flotante. */
  items: { productId: number; quantity: number }[];
  subtotal: number;
  humanHandling: boolean;
};

const MAX_TEXT = 1000;
const MAX_MESSAGES_PER_HOUR = 40;
const MAX_NEW_CHATS_PER_HOUR = 8;
const newChatsByIp = new Map<string, number[]>();

const LIMIT_MSG = {
  es: { tooMany: "Has mandado muchos mensajes. Espera un momento, por favor.", newChats: "Demasiados chats nuevos desde esta conexión. Intenta más tarde." },
  en: { tooMany: "You've sent a lot of messages. Please wait a moment.", newChats: "Too many new chats from this connection. Please try again later." },
};

class ChatError extends Error {}

function lang(value: unknown): Locale {
  return isLocale(value) ? value : "es";
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

async function findConversation(token: string | null | undefined) {
  if (!token || token.length < 20) return null;
  return db.whatsAppConversation.findUnique({ where: { webToken: token } });
}

async function getOrCreateConversation(token: string | null | undefined, locale: Locale) {
  const existing = await findConversation(token);
  if (existing) return existing;

  // Límite de chats nuevos por conexión, para que nadie gaste el saldo de IA a lo loco.
  const ip = await clientIp();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (newChatsByIp.get(ip) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= MAX_NEW_CHATS_PER_HOUR) throw new ChatError(LIMIT_MSG[locale].newChats);
  newChatsByIp.set(ip, [...recent, Date.now()]);

  const webToken = randomBytes(24).toString("base64url");
  return db.whatsAppConversation.create({
    data: {
      channel: "web",
      webToken,
      waId: `web-${webToken.slice(0, 16)}`,
      phoneKey: "",
      draft: JSON.stringify({ items: [], locale } satisfies Draft),
    },
  });
}

async function buildState(conversationId: number): Promise<ChatState> {
  const conversation = await db.whatsAppConversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  const draft = parseDraft(conversation.draft);
  const products = await db.product.findMany({
    where: { id: { in: draft.items.map((i) => i.productId) } },
    select: { id: true, price: true },
  });
  const price = new Map(products.map((p) => [p.id, p.price]));
  return {
    token: conversation.webToken ?? "",
    humanHandling: conversation.botPaused,
    items: draft.items,
    subtotal: draft.items.reduce((s, i) => s + (price.get(i.productId) ?? 0) * i.quantity, 0),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      from: m.direction === "IN" ? "customer" : m.sender === "STAFF" ? "staff" : m.sender === "SYSTEM" ? "system" : "bot",
      text: m.body,
      meta: m.meta ? (JSON.parse(m.meta) as ChatMessage["meta"]) : null,
    })),
  };
}

type Result = { ok: true; state: ChatState } | { ok: false; error: string; state?: ChatState };

/** Estado del chat (para abrirlo o revisar si la tienda contestó). */
export async function getChatState(token: string | null): Promise<ChatState | null> {
  const conversation = await findConversation(token);
  return conversation ? buildState(conversation.id) : null;
}

/** Mensaje del cliente: se guarda y el bot contesta antes de regresar. */
export async function sendChatMessage(input: { token: string | null; text: string; lang: string }): Promise<Result> {
  const locale = lang(input.lang);
  const text = input.text.trim().slice(0, MAX_TEXT);
  if (!text) return { ok: false, error: "" };
  try {
    const conversation = await getOrCreateConversation(input.token, locale);
    const lastHour = await db.whatsAppMessage.count({
      where: { conversationId: conversation.id, direction: "IN", createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (lastHour >= MAX_MESSAGES_PER_HOUR) return { ok: false, error: LIMIT_MSG[locale].tooMany, state: await buildState(conversation.id) };

    const draft = parseDraft(conversation.draft);
    if (draft.locale !== locale) {
      await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { draft: JSON.stringify({ ...draft, locale }) } });
    }
    await recordInbound({ waId: conversation.waId, body: text });
    await processConversation(conversation.id);
    return { ok: true, state: await buildState(conversation.id) };
  } catch (e) {
    if (e instanceof ChatError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Botones del catálogo: cambian la cantidad de un producto en el pedido sin pasar por la IA. */
export async function setOrderItem(input: { token: string | null; productId: number; quantity: number; lang: string }): Promise<Result> {
  const locale = lang(input.lang);
  try {
    const product = await db.product.findUnique({ where: { id: input.productId }, select: { id: true, active: true, stock: true } });
    if (!product || !product.active) return { ok: false, error: "" };
    const conversation = await getOrCreateConversation(input.token, locale);
    const draft = parseDraft(conversation.draft);
    const quantity = Math.max(0, Math.min(Math.floor(input.quantity), product.stock, 99));
    const before = draft.items.find((i) => i.productId === product.id)?.quantity ?? 0;
    draft.items =
      quantity === 0
        ? draft.items.filter((i) => i.productId !== product.id)
        : before
          ? draft.items.map((i) => (i.productId === product.id ? { ...i, quantity } : i))
          : [...draft.items, { productId: product.id, quantity }];
    draft.locale = locale;
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { draft: JSON.stringify(draft) } });
    return { ok: true, state: await buildState(conversation.id) };
  } catch (e) {
    if (e instanceof ChatError) return { ok: false, error: e.message };
    throw e;
  }
}

/** Botón "Confirmar" de la tarjeta de cotización. */
export async function confirmChatOrder(input: { token: string | null; signature: string; lang: string }): Promise<Result> {
  const locale = lang(input.lang);
  const conversation = await findConversation(input.token);
  if (!conversation) return { ok: false, error: "" };

  const result = await confirmConversationOrder(conversation.id, { locale, signature: input.signature });
  if (result.ok) {
    await deliver(conversation, "SYSTEM", locale === "en" ? `Order #${result.order.id} confirmed.` : `Pedido #${result.order.id} confirmado.`, undefined, {
      type: "order",
      order: result.order,
    });
    return { ok: true, state: await buildState(conversation.id) };
  }
  if (result.stale) {
    // Algo cambió (p. ej. agregó un producto desde el catálogo): se muestra la cotización al día.
    const fresh = await db.whatsAppConversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const draft = parseDraft(fresh.draft);
    const quote = await computeQuote(draft, { needsContact: true });
    await deliver(fresh, "SYSTEM", result.error, undefined, { type: "quote", quote });
  }
  return { ok: false, error: result.error, state: await buildState(conversation.id) };
}

/** Botón "Cancelar": vacía el pedido (se recuerdan nombre y teléfono para la próxima). */
export async function cancelChatOrder(input: { token: string | null; lang: string }): Promise<Result> {
  const locale = lang(input.lang);
  const conversation = await findConversation(input.token);
  if (!conversation) return { ok: false, error: "" };
  const draft = parseDraft(conversation.draft);
  const next: Draft = { items: [], customerName: draft.customerName, phone: draft.phone, locale };
  await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { draft: JSON.stringify(next) } });
  await deliver(conversation, "SYSTEM", locale === "en" ? "Order cancelled." : "Pedido cancelado.", undefined, { type: "cancelled" });
  return { ok: true, state: await buildState(conversation.id) };
}
