/** Enlace wa.me con texto prellenado. El número va con lada de país, solo dígitos (p. ej. 5215512345678). */
export function whatsappLink(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
