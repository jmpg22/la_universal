import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cliente mínimo de la WhatsApp Business Cloud API (Meta).
// Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api

export function whatsappConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || "es_MX",
    templateLangEn: process.env.WHATSAPP_TEMPLATE_LANG_EN || "en_US",
    orderUpdateTemplate: process.env.WHATSAPP_TEMPLATE_ORDER_UPDATE ?? "",
    newOrderTemplate: process.env.WHATSAPP_TEMPLATE_NEW_ORDER ?? "",
  };
}

export function isWhatsAppConfigured() {
  const c = whatsappConfig();
  return Boolean(c.token && c.phoneNumberId);
}

export class WhatsAppApiError extends Error {}

async function post(payload: Record<string, unknown>) {
  const c = whatsappConfig();
  const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new WhatsAppApiError(json.error?.message ?? `WhatsApp respondió ${res.status}`);
  }
  return json.messages?.[0]?.id ?? null;
}

export function sendText(to: string, body: string) {
  return post({ recipient_type: "individual", to, type: "text", text: { body: body.slice(0, 4096), preview_url: true } });
}

/** Plantilla aprobada en Meta, con parámetros posicionales {{1}}, {{2}}… en el cuerpo. */
export function sendTemplate(to: string, name: string, params: string[], languageCode = whatsappConfig().templateLang) {
  return post({
    to,
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [],
    },
  });
}

export async function markRead(messageId: string) {
  try {
    await post({ status: "read", message_id: messageId });
  } catch {
    // no es crítico
  }
}

/** Valida la cabecera X-Hub-Signature-256 que Meta firma con el App Secret. */
export function isValidSignature(rawBody: string, header: string | null) {
  const { appSecret } = whatsappConfig();
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
