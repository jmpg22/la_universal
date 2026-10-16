import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getOrCreateConversation } from "./conversations";

/**
 * Guarda un mensaje recibido. Devuelve la conversación, o null si el mensaje ya se había recibido
 * (Meta reintenta los webhooks, así que el mismo mensaje puede llegar más de una vez).
 */
export async function recordInbound(input: { waId: string; name?: string; waMessageId?: string; body: string }) {
  const conversation = await getOrCreateConversation(input.waId, input.name);
  try {
    await db.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "IN",
        sender: "CUSTOMER",
        body: input.body,
        waMessageId: input.waMessageId,
        status: "received",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
  const now = new Date();
  return db.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { lastInboundAt: now, lastMessageAt: now, unread: { increment: 1 } },
  });
}

type WebhookMessage = {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
};

/** Convierte cualquier tipo de mensaje de WhatsApp en texto para el bot y el panel. */
export function messageToText(m: WebhookMessage) {
  switch (m.type) {
    case "text":
      return m.text?.body ?? "";
    case "button":
      return m.button?.text ?? "";
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
    case "location": {
      const l = m.location!;
      const place = [l.name, l.address].filter(Boolean).join(", ");
      return `📍 Ubicación compartida: ${place ? `${place} ` : ""}https://maps.google.com/?q=${l.latitude},${l.longitude}`;
    }
    case "image":
      return "[El cliente mandó una foto]";
    case "audio":
      return "[El cliente mandó un audio]";
    case "sticker":
      return "[Sticker]";
    default:
      return `[Mensaje de tipo ${m.type}]`;
  }
}

export type { WebhookMessage };
