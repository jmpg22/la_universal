import { after } from "next/server";
import { db } from "@/lib/db";
import { isValidSignature, markRead, whatsappConfig } from "@/lib/whatsapp/cloud-api";
import { processConversation } from "@/lib/whatsapp/bot";
import { messageToText, recordInbound, type WebhookMessage } from "@/lib/whatsapp/inbound";

// Webhook de la WhatsApp Cloud API. En Meta: Configuración de WhatsApp → Webhook →
// URL de devolución de llamada = https://TU-DOMINIO/api/whatsapp, campo suscrito: "messages".

/** Verificación inicial que hace Meta al registrar el webhook. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { verifyToken } = whatsappConfig();
  if (
    verifyToken &&
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === verifyToken
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Token de verificación incorrecto", { status: 403 });
}

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: WebhookMessage[];
        statuses?: { id: string; status: string; errors?: { title?: string; message?: string }[] }[];
      };
    }[];
  }[];
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (!isValidSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Firma inválida", { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  const toProcess = new Set<number>();
  for (const change of body.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    const value = change.value;
    if (!value) continue;

    for (const message of value.messages ?? []) {
      const name = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
      const conversation = await recordInbound({
        waId: message.from,
        name,
        waMessageId: message.id,
        body: messageToText(message),
      });
      if (conversation) {
        toProcess.add(conversation.id);
        after(() => markRead(message.id));
      }
    }

    // Confirmaciones de entrega / lectura / error de los mensajes que mandamos.
    for (const status of value.statuses ?? []) {
      await db.whatsAppMessage.updateMany({
        where: { waMessageId: status.id },
        data: {
          status: status.status,
          ...(status.errors?.length && { error: status.errors.map((e) => e.message ?? e.title).join("; ") }),
        },
      });
    }
  }

  // Meta espera respuesta rápida; el bot contesta después de responder el webhook.
  for (const id of toProcess) after(() => processConversation(id));
  return new Response("ok", { status: 200 });
}
