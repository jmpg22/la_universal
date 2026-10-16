import "server-only";
import { db } from "@/lib/db";
import { phoneKey } from "@/lib/whatsapp/phone";

export async function findCustomer(phone: string) {
  return db.customer.findUnique({
    where: { phoneKey: phoneKey(phone) },
    include: { addresses: { orderBy: { lastUsedAt: "desc" }, take: 5 } },
  });
}

/** Registra (o actualiza) cómo le gusta al cliente que le llamen. */
export async function saveCustomerName(waId: string, name: string) {
  const key = phoneKey(waId);
  return db.customer.upsert({
    where: { phoneKey: key },
    update: { name, waId },
    create: { phoneKey: key, waId, name },
  });
}
