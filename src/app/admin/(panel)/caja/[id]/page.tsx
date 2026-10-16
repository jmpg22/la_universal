import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/admin/print-button";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { sessionSummary } from "@/lib/cash";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Corte de caja" };

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t-2 border-stone-200 pt-2 text-lg font-extrabold" : ""}`}>
      <dt className={strong ? "" : "text-stone-600"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export default async function CashSessionPage({ params, searchParams }: PageProps<"/admin/caja/[id]">) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const session = await db.cashSession.findUnique({ where: { id: Number(id) || 0 }, include: { movements: { orderBy: { createdAt: "asc" } } } });
  if (!session) notFound();
  if (!session.closedAt) redirect("/admin/caja");

  const [summary, settings] = await Promise.all([sessionSummary(session), db.settings.findUnique({ where: { id: 1 } })]);
  const totalSales = (session.salesCash ?? 0) + (session.salesCard ?? 0) + (session.salesTransfer ?? 0);
  const diff = session.difference ?? 0;

  return (
    <>
      <PageHeader
        title={`Corte #${session.id}`}
        description={`${formatDateTime(session.openedAt)} – ${formatTime(session.closedAt)}`}
        actions={
          <>
            <PrintButton>🖨️ Imprimir corte</PrintButton>
            <Link href="/admin/caja" className="btn btn-secondary print:hidden">
              ← Volver
            </Link>
          </>
        }
      />

      {query.cerrado === "1" && (
        <p role="status" className="mb-6 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 print:hidden">
          Corte guardado y caja cerrada. Puedes imprimirlo o abrir una caja nueva cuando quieras.
        </p>
      )}

      <div className="mx-auto max-w-2xl space-y-6 print:max-w-none">
        <section className="card space-y-1 p-6 text-center print:shadow-none print:ring-0">
          <p className="text-lg font-extrabold">{settings?.storeName ?? "La Universal"}</p>
          <p className="text-sm text-stone-500">Corte de caja #{session.id}</p>
          <p className="text-sm text-stone-500">
            Abrió {session.openedBy} · {formatDateTime(session.openedAt)}
          </p>
          <p className="text-sm text-stone-500">
            Cerró {session.closedBy} · {formatDateTime(session.closedAt)}
          </p>
        </section>

        <section className="card p-6 print:shadow-none print:ring-0">
          <h2 className="mb-3 font-extrabold">Ventas cobradas</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label={`💵 Efectivo`} value={formatMoney(session.salesCash ?? 0)} />
            <Row label={`💳 Tarjeta`} value={formatMoney(session.salesCard ?? 0)} />
            <Row label={`📲 Transferencia`} value={formatMoney(session.salesTransfer ?? 0)} />
            {(session.discounts ?? 0) > 0 && <Row label="🎁 Descuentos por promociones (ya restados)" value={`−${formatMoney(session.discounts ?? 0)}`} />}
            <Row label={`Total (${session.salesCount ?? 0} ventas)`} value={formatMoney(totalSales)} strong />
          </dl>
        </section>

        <section className="card p-6 print:shadow-none print:ring-0">
          <h2 className="mb-3 font-extrabold">Efectivo</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Fondo inicial" value={formatMoney(session.openingCash)} />
            <Row label="+ Ventas en efectivo" value={formatMoney(session.salesCash ?? 0)} />
            {session.movements.map((m) => (
              <Row key={m.id} label={`${m.kind === "IN" ? "+" : "−"} ${m.reason} (${formatTime(m.createdAt)})`} value={formatMoney(m.amount)} />
            ))}
            <Row label="= Efectivo esperado" value={formatMoney(session.expectedCash ?? 0)} strong />
            <Row label="Efectivo contado" value={formatMoney(session.countedCash ?? 0)} />
          </dl>
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-center text-xl font-extrabold ${
              diff === 0 ? "bg-brand-50 text-brand-800" : diff > 0 ? "bg-sky-50 text-sky-800" : "bg-red-50 text-red-700"
            }`}
          >
            {diff === 0 ? "✅ La caja cuadra" : diff > 0 ? `Sobrante: ${formatMoney(diff)}` : `Faltante: ${formatMoney(-diff)}`}
          </p>
          {session.notes && <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">📝 {session.notes}</p>}
        </section>

        {summary.topProducts.length > 0 && (
          <section className="card overflow-hidden print:shadow-none print:ring-0">
            <h2 className="px-6 pt-5 pb-2 font-extrabold">Productos vendidos</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-stone-100">
                {summary.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td className="px-6 py-1.5">{p.name}</td>
                    <td className="px-6 py-1.5 text-right tabular-nums">{p.quantity}</td>
                    <td className="px-6 py-1.5 text-right font-semibold tabular-nums">{formatMoney(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
