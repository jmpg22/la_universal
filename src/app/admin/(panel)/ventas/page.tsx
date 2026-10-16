import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { BarChart } from "@/components/admin/bar-chart";
import { EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/admin/ui";
import type { OrderChannel } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { CHANNEL_LABEL, PAYMENT_LABEL, addDays, formatDateTime, formatMoney } from "@/lib/format";
import { salesReport, shortDay, todayKey, weekdayDay } from "@/lib/sales";

export const metadata: Metadata = { title: "Ventas" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function presets(today: string) {
  return [
    { label: "Hoy", from: today, to: today },
    { label: "Ayer", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "7 días", from: addDays(today, -6), to: today },
    { label: "30 días", from: addDays(today, -29), to: today },
    { label: "Este mes", from: `${today.slice(0, 8)}01`, to: today },
  ];
}

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

export default async function SalesPage({ searchParams }: PageProps<"/admin/ventas">) {
  await requireAdmin();
  const params = await searchParams;
  const today = todayKey();
  let from = typeof params.desde === "string" && DATE_RE.test(params.desde) ? params.desde : addDays(today, -6);
  let to = typeof params.hasta === "string" && DATE_RE.test(params.hasta) ? params.hasta : today;
  if (from > to) [from, to] = [to, from];
  const channel = params.canal === "ONLINE" || params.canal === "COUNTER" || params.canal === "WHATSAPP" ? (params.canal as OrderChannel) : undefined;

  const report = await salesReport(from, to, channel);
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

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {presets(today).map((p) => (
            <Link
              key={p.label}
              href={`/admin/ventas${qs({ desde: p.from, hasta: p.to })}`}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${
                p.from === from && p.to === to ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <Form action="/admin/ventas" className="flex flex-wrap items-end gap-2">
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
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vendido" value={formatMoney(report.total)} hint={report.deliveryFees ? `Incluye ${formatMoney(report.deliveryFees)} de envíos` : undefined} />
        <StatCard label="Ventas" value={String(report.count)} />
        <StatCard label="Ticket promedio" value={formatMoney(report.average)} />
        <StatCard label="Web / WhatsApp / mostrador" value={`${online.count} / ${whatsapp.count} / ${counter.count}`} hint={`${formatMoney(online.total)} / ${formatMoney(whatsapp.total)} / ${formatMoney(counter.total)}`} />
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
              <h2 className="px-5 pt-4 pb-2 font-extrabold">Productos más vendidos</h2>
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
        Se cuentan todos los pedidos excepto los <StatusBadge status="CANCELLED" />. Los pedidos web y de WhatsApp cuentan desde que se reciben.
      </p>
    </>
  );
}
