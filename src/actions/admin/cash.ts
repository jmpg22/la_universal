"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getOpenSession, sessionSummary } from "@/lib/cash";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/format";

export type CashState = { error?: string; ok?: string } | undefined;

export async function openCash(_prev: CashState, formData: FormData): Promise<CashState> {
  const admin = await requireAdmin();
  if (await getOpenSession()) return { error: "Ya hay una caja abierta." };
  const openingCash = parseMoney(formData.get("openingCash"));
  if (openingCash == null) return { error: "Escribe el fondo inicial (puede ser 0)." };
  await db.cashSession.create({ data: { openingCash, openedBy: admin.name } });
  refresh();
  return { ok: "Caja abierta." };
}

export async function addCashMovement(_prev: CashState, formData: FormData): Promise<CashState> {
  const admin = await requireAdmin();
  const session = await getOpenSession();
  if (!session) return { error: "Primero abre la caja." };
  const kind = formData.get("kind") === "IN" ? "IN" : "OUT";
  const amount = parseMoney(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 120);
  if (!amount) return { error: "Escribe el monto." };
  if (!reason) return { error: "Escribe el motivo (p. ej. pago a proveedor, retiro)." };
  await db.cashMovement.create({ data: { sessionId: session.id, kind, amount, reason, createdBy: admin.name } });
  refresh();
  return { ok: kind === "IN" ? "Entrada registrada." : "Salida registrada." };
}

export async function deleteCashMovement(id: number) {
  await requireAdmin();
  const movement = await db.cashMovement.findUnique({ where: { id }, include: { session: { select: { closedAt: true } } } });
  // Un corte cerrado ya no se modifica.
  if (movement && !movement.session.closedAt) await db.cashMovement.delete({ where: { id } });
  refresh();
}

export async function closeCash(_prev: CashState, formData: FormData): Promise<CashState> {
  const admin = await requireAdmin();
  const session = await getOpenSession();
  if (!session) return { error: "No hay caja abierta." };
  const countedCash = parseMoney(formData.get("countedCash"));
  if (countedCash == null) return { error: "Escribe cuánto efectivo contaste." };

  const closedAt = new Date();
  const summary = await sessionSummary({ ...session, closedAt });
  await db.cashSession.update({
    where: { id: session.id },
    data: {
      closedAt,
      closedBy: admin.name,
      salesCount: summary.count,
      salesCash: summary.byMethod.CASH,
      salesCard: summary.byMethod.CARD,
      salesTransfer: summary.byMethod.TRANSFER,
      discounts: summary.discounts,
      expectedCash: summary.expectedCash,
      countedCash,
      difference: countedCash - summary.expectedCash,
      notes: String(formData.get("notes") ?? "").trim().slice(0, 500),
    },
  });
  redirect(`/admin/caja/${session.id}?cerrado=1`);
}
