import type { DeliveryType, OrderStatus } from "@/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function orderSteps(deliveryType: DeliveryType, lang: Locale = "es"): { status: OrderStatus; label: string }[] {
  const t = getDictionary(lang).steps;
  return deliveryType === "DELIVERY"
    ? [
        { status: "PENDING", label: t.received },
        { status: "CONFIRMED", label: t.confirmed },
        { status: "PREPARING", label: t.preparing },
        { status: "OUT_FOR_DELIVERY", label: t.onTheWay },
        { status: "DELIVERED", label: t.delivered },
      ]
    : [
        { status: "PENDING", label: t.received },
        { status: "CONFIRMED", label: t.confirmed },
        { status: "PREPARING", label: t.preparing },
        { status: "READY", label: t.readyPickup },
        { status: "DELIVERED", label: t.delivered },
      ];
}

const ORDER: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"];

export function OrderProgress({
  status,
  deliveryType,
  lang = "es",
}: {
  status: OrderStatus;
  deliveryType: DeliveryType;
  lang?: Locale;
}) {
  if (status === "CANCELLED") {
    return <p className="rounded-xl bg-stone-100 px-4 py-3 font-bold text-stone-700">{getDictionary(lang).order.cancelled}</p>;
  }
  const steps = orderSteps(deliveryType, lang);
  const currentRank = ORDER.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1">
      {steps.map((step, i) => {
        const done = ORDER.indexOf(step.status) <= currentRank;
        const isCurrent = done && (i === steps.length - 1 || ORDER.indexOf(steps[i + 1].status) > currentRank);
        return (
          <li key={step.status} className="flex flex-col items-center gap-2 text-center">
            <span
              className={`h-2 w-full rounded-full ${done ? "bg-brand-500" : "bg-stone-200"} ${isCurrent ? "animate-pulse" : ""}`}
            />
            <span className={`text-xs leading-tight font-bold sm:text-sm ${done ? "text-brand-800" : "text-stone-400"}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
