import type { DeliveryType, OrderChannel, OrderStatus, PaymentMethod, StockReason } from "@/generated/prisma/enums";

// La tienda opera en la Ciudad de México (UTC-6 todo el año desde 2022).
export const TIME_ZONE = "America/Mexico_City";
export const UTC_OFFSET = "-06:00";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMoney(cents: number) {
  return money.format(cents / 100);
}

export function formatDateTime(date: Date | string, intlLocale = "es-MX") {
  return new Intl.DateTimeFormat(intlLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(date));
}

/** Fecha local de la tienda en formato YYYY-MM-DD. */
export function localDateKey(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(date));
}

/** Inicio del día local (YYYY-MM-DD) como instante UTC. */
export function startOfLocalDay(key: string) {
  return new Date(`${key}T00:00:00${UTC_OFFSET}`);
}

export function addDays(key: string, days: number) {
  const d = startOfLocalDay(key);
  d.setUTCDate(d.getUTCDate() + days);
  return localDateKey(d);
}

/** Convierte "45.50" o "45" a centavos. Devuelve null si no es un número válido. */
export function parseMoney(value: FormDataEntryValue | null | undefined): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Nuevo",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Listo",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-sky-100 text-sky-800 ring-sky-200",
  PREPARING: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  READY: "bg-teal-100 text-teal-800 ring-teal-200",
  OUT_FOR_DELIVERY: "bg-violet-100 text-violet-800 ring-violet-200",
  DELIVERED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-stone-200 text-stone-600 ring-stone-300",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

export const DELIVERY_LABEL: Record<DeliveryType, string> = {
  PICKUP: "Recoger en tienda",
  DELIVERY: "Envío a domicilio",
};

export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  ONLINE: "Tienda web",
  WHATSAPP: "WhatsApp",
  COUNTER: "Mostrador",
};

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  SALE: "Venta",
  RESTOCK: "Entrada",
  ADJUSTMENT: "Ajuste",
  CANCEL: "Cancelación",
};

export const UNITS = ["pieza", "kg", "litro", "paquete", "lata", "frasco", "caja", "bolsa"];
