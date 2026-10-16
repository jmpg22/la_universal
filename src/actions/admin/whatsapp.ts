"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { processConversation } from "@/lib/whatsapp/bot";
import { deliver } from "@/lib/whatsapp/conversations";
import { recordInbound } from "@/lib/whatsapp/inbound";
import { isSimulated } from "@/lib/whatsapp/phone";

export type ReplyState = { error?: string; sent?: number } | undefined;

/** Respuesta escrita por alguien de la tienda. Pausa el bot en ese chat para que no se encimen. */
export async function sendStaffReply(conversationId: number, _prev: ReplyState, formData: FormData): Promise<ReplyState> {
  await requireAdmin();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Escribe un mensaje." };
  if (text.length > 4000) return { error: "El mensaje es demasiado largo." };

  const conversation = await db.whatsAppConversation.update({
    where: { id: conversationId },
    data: { botPaused: true, unread: 0 },
  });
  const message = await deliver(conversation, "STAFF", text);
  refresh();
  if (message.status === "failed" || message.status === "omitido") return { error: message.error, sent: message.id };
  return { sent: message.id };
}

export async function setBotPaused(conversationId: number, paused: boolean) {
  await requireAdmin();
  await db.whatsAppConversation.update({ where: { id: conversationId }, data: { botPaused: paused } });
  refresh();
}

export type SimulateState = { error?: string } | undefined;

/** Simula un mensaje de un cliente: pasa por el mismo bot, pero las respuestas no salen a WhatsApp. */
export async function simulateCustomerMessage(_prev: SimulateState, formData: FormData): Promise<SimulateState> {
  await requireAdmin();
  const text = String(formData.get("text") ?? "").trim();
  const conversationId = Number(formData.get("conversationId")) || undefined;
  if (!text) return { error: "Escribe lo que diría el cliente." };

  // Sin conversación previa: cliente nuevo de prueba (número ficticio de 10 dígitos para que se registre como cualquiera).
  let waId = `sim-${Date.now().toString().slice(-10)}`;
  if (conversationId) {
    const existing = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
    if (existing && isSimulated(existing.waId)) waId = existing.waId;
  }
  const conversation = await recordInbound({ waId, name: "Cliente de prueba", body: text });
  if (!conversation) return { error: "No se pudo guardar el mensaje." };

  await processConversation(conversation.id);
  redirect(`/admin/whatsapp?c=${conversation.id}`);
}

export async function deleteSimulation(conversationId: number) {
  await requireAdmin();
  const conversation = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (conversation && isSimulated(conversation.waId)) {
    await db.whatsAppConversation.delete({ where: { id: conversationId } });
  }
  redirect("/admin/whatsapp");
}
