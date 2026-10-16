import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BarChart } from "@/components/admin/bar-chart";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import type { OrderChannel } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { CHANNEL_LABEL, PAYMENT_LABEL, formatDateTime, formatMoney } from "@/lib/format";
import { type PeriodKey, periodRange, salesReport, shortDay, todayKey, weekdayDay } from "@/lib/sales";
import { SalesTabs } from "./sales-tabs";

export const metadata: Metadata = { title: "Ventas" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ShareBars({ rows }: { rows: { label: string; total: number; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between">
            <span className="font-semibold text-stone-700">{r.label}</span>
            <span className="tabular-nums">
              {formatMoney(r.total)} <span className="text-stone-400">· {r.count}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full bg-brand-500" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tarjeta con el valor del periodo y la comparación contra el periodo anterior. */
function CompareCard({ label, value, previous, format, prevLabel }: { label: string; value: number; previous: number; format: (n: number) => string; prevLabel: string }) {
  const diff = value - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null;
  const up = diff > 0;
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-stone-900 tabular-nums">{format(value)}</p>
      <p className="mt-1 text-xs text-stone-500">
        {diff === 0 ? (
          <span className="font-bold text-stone-500">= igual</span>
        ) : (
          <span className={`font-bold ${up ? "text-brand-700" : "text-red-600"}`}>
            {up ? "▲" : "▼"} {format(Math.abs(diff))}
            {pct != null && ` (${up ? "+" : "−"}${Math.abs(pct)}%)`}
          </span>
        )}{" "}
        vs {prevLabel} ({format(previous)})
      </p>
    </div>
  );
}

export default async function SalesPage({ searchParams }: PageProps<"/admin/ventas">) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayKey();
  const channel = params.canal === "ONLINE" || params.canal === "COUNTER" || params.canal === "WHATSAPP" ? (params.canal as OrderChannel) : undefined;

  // Periodo: hoy / semana / mes, o un rango con "desde" y "hasta".
  const custom = params.periodo === "rango" || (typeof params.desde === "string" && DATE_RE.test(params.desde));
  const periodKey: PeriodKey = params.periodo === "semana" || params.periodo === "mes" ? params.periodo : "hoy";
  let from: string, to: string, prevFrom: string, prevTo: string, prevLabel: string;
  if (custom) {
    from = typeof params.desde === "string" && DATE_RE.test(params.desde) ? params.desde : today;
    to = typeof params.hasta === "string" && DATE_RE.test(params.hasta) ? params.hasta : today;
    if (from > to) [from, to] = [to, from];
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    prevTo = new Date(Date.parse(from) - 86_400_000).toISOString().slice(0, 10);
    prevFrom = new Date(Date.parse(from) - days * 86_400_000).toISOString().slice(0, 10);
    prevLabel = "el periodo anterior";
  } else {
    ({ from, to, prevFrom, prevTo, prevLabel } = periodRange(periodKey, today));
  }

  const [report, previous] = await Promise.all([salesReport(from, to, channel), salesReport(prevFrom, prevTo, channel)]);
  const singleDay = from === to;
  const qs = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { desde: from, hasta: to, canal: channel, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    return `?${sp}`;
  };

  const online = report.byChannel.get("ONLINE") ?? { total: 0, count: 0 };
  const whatsapp = report.byChannel.get("WHATSAPP") ?? { total: 0, count: 0 };
  const counter = report.byChannel.get("COUNTER") ?? { total: 0, count: 0 };
  const money = (n: number) => formatMoney(n);
  const plain = (n: number) => new Intl.NumberFormat("es-MX").format(n);

  return (
    <>
      <PageHeader
        title="Ventas"
        description={singleDay ? weekdayDay(from) : `Del ${shortDay(from)} al ${shortDay(to)}`}
        actions={
          <a href={`/admin/ventas/csv${qs({})}`} className="btn btn-secondary">
            ⬇ Descargar CSV
          </a>
        }
      />
      <SalesTabs current={custom ? "rango" : periodKey} />

      {custom && (
        <Form action="/admin/ventas" className="card mb-6 flex flex-wrap items-end gap-2 p-4">
          <input type="hidden" name="periodo" value="rango" />
          <div>
            <label htmlFor="desde" className="label text-xs">Desde</label>
            <input id="desde" name="desde" type="date" defaultValue={from} max={today} className="input py-1.5" />
          </div>
          <div>
            <label htmlFor="hasta" className="label text-xs">Hasta</label>
            <input id="hasta" name="hasta" type="date" defaultValue={to} max={today} className="input py-1.5" />
          </div>
          <div>
            <label htmlFor="canal" className="label text-xs">Canal</label>
            <select id="canal" name="canal" defaultValue={channel ?? ""} className="input py-1.5">
              <option value="">Todos</option>
              <option value="ONLINE">Tienda web</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="COUNTER">Mostrador</option>
            </select>
          </div>
          <button type="submit" className="btn btn-secondary py-1.5">
            Ver
          </button>
        </Form>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CompareCard label="Vendido" value={report.total} previous={previous.total} format={money} prevLabel={prevLabel} />
        <CompareCard label="Número de ventas" value={report.count} previous={previous.count} format={plain} prevLabel={prevLabel} />
        <CompareCard label="Ticket promedio" value={report.average} previous={previous.average} format={money} prevLabel={prevLabel} />
        <div className="card p-4">
          <p className="text-sm font-semibold text-stone-500">Por canal</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            <li className="flex justify-between">
              <span>🌐 Web</span>
              <span className="font-bold tabular-nums">{formatMoney(online.total)}</span>
            </li>
            <li className="flex justify-between">
              <span>💬 WhatsApp</span>
              <span className="font-bold tabular-nums">{formatMoney(whatsapp.total)}</span>
            </li>
            <li className="flex justify-between">
              <span>🏪 Mostrador</span>
              <span className="font-bold tabular-nums">{formatMoney(counter.total)}</span>
            </li>
          </ul>
        </div>
      </div>

      {report.count === 0 ? (
        <EmptyState icon="📈" title="No hay ventas en este periodo" />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="card p-5">
              <h2 className="mb-1 font-extrabold">{singleDay ? "Ventas por hora" : "Ventas por día"}</h2>
              <p className="mb-4 text-xs text-stone-500">Pasa el cursor sobre una barra para ver el detalle.</p>
              <BarChart
                title={singleDay ? "Ventas por hora" : "Ventas por día"}
                data={
                  singleDay
                    ? report.byHour
                        .map((h, hour) => ({ key: String(hour), label: `${hour}:00`, value: h.total, detail: `${h.count} ventas` }))
                        .filter((_, hour) => hour >= 6 && hour <= 23)
                    : report.byDay.map((d) => ({ key: d.key, label: shortDay(d.key), value: d.total, detail: `${d.count} ventas` }))
                }
              />
            </section>
            <section className="card space-y-6 p-5">
              <div>
                <h2 className="mb-3 font-extrabold">Forma de pago</h2>
                <ShareBars
                  rows={[...report.byPayment]
                    .map(([method, v]) => ({ label: PAYMENT_LABEL[method], ...v }))
                    .sort((a, b) => b.total - a.total)}
                />
              </div>
              {!channel && (
                <div>
                  <h2 className="mb-3 font-extrabold">Canal</h2>
                  <ShareBars
                    rows={[
                      { label: CHANNEL_LABEL.ONLINE, ...online },
                      { label: CHANNEL_LABEL.WHATSAPP, ...whatsapp },
                      { label: "Mostrador", ...counter },
                    ]}
                  />
                </div>
              )}
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
                <h2 className="font-extrabold">Productos más vendidos</h2>
                <Link href={`/admin/ventas/productos${qs({})}`} className="text-sm font-bold text-brand-700 hover:underline">
                  Ver todos y lo que no se vende →
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-bold tracking-wide text-stone-500 uppercase">
                  <tr>
                    <th className="px-5 py-2">Producto</th>
                    <th className="px-5 py-2 text-right">Unidades</th>
                    <th className="px-5 py-2 text-right">Vendido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.topProducts.slice(0, 15).map((p) => (
                    <tr key={`${p.productId}-${p.name}`}>
                      <td className="px-5 py-2 font-semibold">
                        {p.productId ? (
                          <Link href={`/admin/productos/${p.productId}`} className="hover:text-brand-700">
                            {p.name}
                          </Link>
                        ) : (
                          p.name
                        )}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums">{p.quantity}</td>
                      <td className="px-5 py-2 text-right font-semibold tabular-nums">{formatMoney(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card overflow-hidden">
              <h2 className="px-5 pt-4 pb-2 font-extrabold">Ventas del periodo</h2>
              <ul className="max-h-[480px] divide-y divide-stone-100 overflow-y-auto text-sm">
                {[...report.orders].reverse().map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-2 hover:bg-stone-50">
                      <span>
                        <span className="font-bold">#{o.id}</span>{" "}
                        <span className="text-stone-500">
                          {CHANNEL_LABEL[o.channel]} · {PAYMENT_LABEL[o.paymentMethod]}
                        </span>
                        <span className="block text-xs text-stone-400">{formatDateTime(o.createdAt)}</span>
                      </span>
                      <span className="font-extrabold tabular-nums">{formatMoney(o.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
      <p className="mt-6 text-xs text-stone-500">
        Se cuentan todos los pedidos excepto los <StatusBadge status="CANCELLED" />, por la fecha en que se recibieron. El{" "}
        <Link href="/admin/caja" className="underline">
          corte de caja
        </Link>{" "}
        cuenta por la fecha en que se entregaron y cobraron.
      </p>
    </>
  );
}
