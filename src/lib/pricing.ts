export type DeliveryRules = { deliveryFee: number; freeDeliveryMin: number };

/** Costo de envío según el subtotal. Compartido por el checkout (cliente) y el servidor. */
export function deliveryFeeFor(rules: DeliveryRules, subtotal: number, deliveryType: "PICKUP" | "DELIVERY") {
  if (deliveryType !== "DELIVERY") return 0;
  const free = rules.freeDeliveryMin > 0 && subtotal >= rules.freeDeliveryMin;
  return free ? 0 : rules.deliveryFee;
}
