import type { Metadata } from "next";
import Link from "next/link";
import { deleteCashMovement } from "@/actions/admin/cash";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { EmptyState, PageHeader, StatCard } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireAdmin } from "@/lib/auth";
import { getOpenSession, pendingDeliveries, sessionSummary } from "@/lib/cash";
import { db } from "@/lib/db";
import { CHANNEL_LABEL, PAYMENT_LABEL, formatDateTime, formatMoney, formatTime } from "@/lib/format";
import { CloseCashForm, MovementForm, OpenCashForm } from "./cash-forms";

export const metadata: Metadata = { title: "Corte de caja" };

function Difference({ value }: { value: number | null }) {
  if (value == null) return <span className="text-stone-400">—</span>;
  if (value === 0) return <span className="font-bold text-brand-700">Cuadra</span>;
  return <span className={`font-bold ${value > 0 ? "text-sky-700" : "text-red-600"}`}>{value > 0 ? `+${formatMoney(value)}` : `−${formatMoney(-value)}`}</span>;
}

export default async function CashPage() {
  await requireAdmin();
  const [session, history, pending] = await Promise.all([
    getOpenSession(),
    db.cashSession.findMany({ where: { closedAt: { not: null } }, orderBy: { closedAt: "desc" }, take: 30 }),
    pendingDeliveries(),
  ]);
  const summary = session ? await sessionSummary(session) : null;

  return (
    <>
      {session && <AutoRefresh seconds={60} />}
      <PageHeader
        title="Corte de caja"
        description={
          session
            ? `Caja abierta desde ${formatDateTime(session.openedAt)} por ${session.openedBy}.`
            : "Abre la caja al empezar el día y haz el corte al cerrar."
        }
      />

      {!session || !summary ? (
        <section className="card mb-8 max-w-lg p-6">
          <h2 className="mb-1 text-lg font-extrabold">🔒 La caja está cerrada</h2>
          <p className="mb-4 text-sm text-stone-500">
            Al abrirla empiezan a contar las ventas cobradas (mostrador y pedidos entregados) hasta que hagas el corte.
          </p>
          <OpenCashForm />
        </section>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Vendido en esta caja" value={formatMoney(summary.total)} hint={`${summary.count} ventas${summary.discounts ? ` · ${formatMoney(summary.discounts)} en promociones` : ""}`} />
            <StatCard label="💵 Efectivo" value={formatMoney(summary.byMethod.CASH)} hint={`${summary.countByMethod.CASH} ventas`} />
            <StatCard label="💳 Tarjeta" value={formatMoney(summary.byMethod.CARD)} hint={`${summary.countByMethod.CARD} ventas · revisa la terminal`} />
            <StatCard label="📲 Transferencia" value={formatMoney(summary.byMethod.TRANSFER)} hint={`${summary.countByMethod.TRANSFER} ventas · revisa el banco`} />
          </div>

          {pending._count > 0 && (
            <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              ⏳ Hay <strong>{pending._count} pedidos por entregar</strong> ({formatMoney(pending._sum.total ?? 0)}). Entran al corte cuando los marques como
              entregados (que es cuando se cobran).{" "}
              <Link href="/admin/pedidos" className="font-bold underline">
                Ver pedidos
              </Link>
            </p>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <section className="card p-5">
                <h2 className="mb-3 font-extrabold">Efectivo que debe haber en la caja</h2>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-600">Fondo inicial</dt>
                    <dd className="tabular-nums">{formatMoney(session.openingCash)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">+ Ventas en efectivo</dt>
                    <dd className="tabular-nums">{formatMoney(summary.byMethod.CASH)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">+ Entradas</dt>
                    <dd className="tabular-nums">{formatMoney(summary.cashIn)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">− Salidas</dt>
                    <dd className="tabular-nums">{formatMoney(summary.cashOut)}</dd>
                  </div>
                  <div className="flex justify-between border-t-2 border-stone-200 pt-2 text-2xl font-extrabold">
                    <dt>= Esperado</dt>
                    <dd className="tabular-nums">{formatMoney(summary.expectedCash)}</dd>
                  </div>
                </dl>
              </section>

              <section className="card overflow-hidden">
                <h2 className="px-5 pt-4 pb-2 font-extrabold">Entradas y salidas de efectivo</h2>
                {session.movements.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-stone-500">Sin movimientos todavía.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 text-sm">
                    {session.movements.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="w-14 text-stone-400 tabular-nums">{formatTime(m.createdAt)}</span>
                        <span className="flex-1">
                          {m.reason}
                          <span className="block text-xs text-stone-400">{m.createdBy}</span>
                        </span>
                        <span className={`font-bold tabular-nums ${m.kind === "IN" ? "text-brand-700" : "text-red-600"}`}>
                          {m.kind === "IN" ? "+" : "−"}
                          {formatMoney(m.amount)}
                        </span>
                        <form action={deleteCashMovement.bind(null, m.id)}>
                          <ConfirmButton className="rounded-lg px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-600" message="¿Borrar este movimiento?">
                            ✕
                          </ConfirmButton>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card overflow-hidden">
                <details>
                  <summary className="cursor-pointer px-5 py-4 font-extrabold">Ventas cobradas en esta caja ({summary.count})</summary>
                  <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto border-t border-stone-100 text-sm">
                    {[...summary.orders].reverse().map((o) => (
                      <li key={o.id}>
                        <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-3 px-5 py-2 hover:bg-stone-50">
                          <span className="w-14 text-stone-400 tabular-nums">{o.deliveredAt ? formatTime(o.deliveredAt) : ""}</span>
                          <span className="flex-1">
                            #{o.id} · {CHANNEL_LABEL[o.channel]}
                            <span className="block text-xs text-stone-400">{PAYMENT_LABEL[o.paymentMethod]}</span>
                          </span>
                          <span className="font-bold tabular-nums">{formatMoney(o.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </section>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6">
              <section className="card p-5">
                <h2 className="mb-3 font-extrabold">Registrar entrada o salida</h2>
                <MovementForm />
              </section>
              <section className="card p-5 ring-2 ring-stone-900/10">
                <h2 className="mb-3 font-extrabold">Hacer el corte</h2>
                <CloseCashForm expectedCash={summary.expectedCash} />
              </section>
            </aside>
          </div>
        </>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-extrabold">Cortes anteriores</h2>
        {history.length === 0 ? (
          <EmptyState icon="🧾" title="Aún no hay cortes" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-stone-50 text-left text-xs font-bold tracking-wide text-stone-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Corte</th>
                  <th className="px-4 py-3 text-right">Ventas</th>
                  <th className="px-4 py-3 text-right">Vendido</th>
                  <th className="px-4 py-3 text-right">Efectivo esperado</th>
                  <th className="px-4 py-3 text-right">Contado</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/caja/${h.id}`} className="font-bold text-brand-700 hover:underline">
                        #{h.id} · {formatDateTime(h.closedAt!)}
                      </Link>
                      <span className="block text-xs text-stone-400">
                        {formatTime(h.openedAt)} – {formatTime(h.closedAt!)} · {h.closedBy}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{h.salesCount ?? 0}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatMoney((h.salesCash ?? 0) + (h.salesCard ?? 0) + (h.salesTransfer ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(h.expectedCash ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(h.countedCash ?? 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <Difference value={h.difference} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
