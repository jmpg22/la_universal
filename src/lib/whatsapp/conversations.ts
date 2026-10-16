import "server-only";
import { db } from "@/lib/db";
import type { MessageSender } from "@/generated/prisma/enums";
import { isWhatsAppConfigured, sendTemplate, sendText } from "./cloud-api";
import { isSimulated, isWebChat, phoneKey } from "./phone";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * El nombre del perfil de WhatsApp solo se usa si el chat aún no tiene nombre:
 * una vez que el cliente se registra, manda el nombre que nos dio.
 */
export async function getOrCreateConversation(waId: string, name?: string) {
  const conversation = await db.whatsAppConversation.upsert({
    where: { waId },
    update: {},
    create: { waId, phoneKey: phoneKey(waId), name: name ?? "" },
  });
  if (name && !conversation.name) {
    return db.whatsAppConversation.update({ where: { id: conversation.id }, data: { name } });
  }
  return conversation;
}

/** Busca la conversación de un teléfono escrito en un pedido web (55 1234 5678, 5215512345678…). */
export async function findConversationByPhone(phone: string) {
  // Solo conversaciones de WhatsApp reales: a un chat web o de prueba no se le pueden mandar avisos.
  return db.whatsAppConversation.findFirst({
    where: { phoneKey: phoneKey(phone), channel: "whatsapp", NOT: { waId: { startsWith: "sim" } } },
    orderBy: { lastInboundAt: "desc" },
  });
}

export function insideWindow(conversation: { lastInboundAt: Date | null }) {
  return conversation.lastInboundAt != null && Date.now() - conversation.lastInboundAt.getTime() < WINDOW_MS;
}

/**
 * Envía un mensaje y lo deja guardado en la conversación.
 * - Conversaciones de prueba o sin credenciales: se guarda como "simulado", no sale nada.
 * - Dentro de las 24 h desde el último mensaje del cliente: texto libre.
 * - Fuera de esa ventana, WhatsApp solo permite plantillas aprobadas; si no hay, se registra como "omitido".
 */
export async function deliver(
  conversation: { id: number; waId: string; lastInboundAt: Date | null },
  sender: MessageSender,
  text: string,
  template?: { name: string; params: string[]; languageCode?: string },
  meta?: unknown,
) {
  let status = "sent";
  let error = "";
  let waMessageId: string | null = null;

  if (isWebChat(conversation.waId)) {
    status = "web"; // el chat de la página lo lee directo de la base de datos
  } else if (isSimulated(conversation.waId) || !isWhatsAppConfigured()) {
    status = "simulado";
  } else {
    try {
      if (insideWindow(conversation)) {
        waMessageId = await sendText(conversation.waId, text);
      } else if (template?.name) {
        waMessageId = await sendTemplate(conversation.waId, template.name, template.params, template.languageCode);
      } else {
        status = "omitido";
        error = "Fuera de la ventana de 24 h y sin plantilla configurada.";
      }
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
      console.error("[whatsapp] envío fallido:", error);
    }
  }

  return db.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "OUT",
      sender,
      body: text,
      waMessageId,
      status,
      error,
      meta: meta === undefined ? "" : JSON.stringify(meta),
    },
  }).then(async (message) => {
    await db.whatsAppConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
    return message;
  });
}
