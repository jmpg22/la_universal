/** Últimos 10 dígitos: sirve para emparejar "5215512345678" (WhatsApp) con "55 1234 5678" (formulario web). */
export function phoneKey(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Número para la API de WhatsApp. Un número mexicano de 10 dígitos recibe la lada 52. */
export function toWaId(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `52${digits}` : digits;
}

/** Chats de la página web: los mensajes se quedan en la página, no salen a WhatsApp. */
export function isWebChat(waId: string) {
  return waId.startsWith("web-");
}

/** Conversaciones creadas desde el simulador del panel; nunca se envían a WhatsApp. */
export function isSimulated(waId: string) {
  return waId.startsWith("sim");
}

export function formatWaId(waId: string) {
  if (isSimulated(waId)) return "Prueba";
  if (isWebChat(waId)) return "Chat de la página";
  const ten = phoneKey(waId);
  return ten.length === 10 ? `${ten.slice(0, 2)} ${ten.slice(2, 6)} ${ten.slice(6)}` : waId;
}
