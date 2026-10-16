import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, StatCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { addDays, formatMoney } from "@/lib/format";
import { periodRange, productPerformance, shortDay, todayKey } from "@/lib/sales";
import { SalesTabs } from "../sales-tabs";

export const metadata: Metadata = { title: "Productos vendidos" };

const PERIODS = {
  semana: "Esta semana",
  mes: "Este mes",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
} as const;
type Period = keyof typeof PERIODS;

function daysAgo(date: Date | null) {
  if (!date) return "Nunca";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

export default async function ProductSalesPage({ searchParams }: PageProps<"/admin/ventas/productos">) {
  await requireAdmin();
  const params = await searchParams;
  const period: Period = typeof params.periodo === "string" && params.periodo in PERIODS ? (params.periodo as Period) : "30";
  const byUnits = params.orden === "unidades";
  const today = todayKey();
  const range =
    period === "semana" || period === "mes"
      ? periodRange(period, today)
      : { from: addDays(today, -(Number(period) - 1)), to: today };

  const all = (await productPerformance(range.from, range.to)).filter((p) => p.active);
  const sold = all.filter((p) => p.units > 0).sort((a, b) => (byUnits ? b.units - a.units : b.revenue - a.revenue));
  const totalRevenue = sold.reduce((s, p) => s + p.revenue, 0);
  const maxValue = Math.max(...sold.map((p) => (byUnits ? p.units : p.revenue)), 1);
  const slow = [...sold].sort((a, b) => a.units - b.units || a.revenue - b.revenue).slice(0, 10);
  const notSold = all
    .filter((p) => p.units === 0)
    .map((p) => ({ ...p, stockValue: Math.max(0, p.stock) * p.price }))
    .sort((a, b) => b.stockValue - a.stockValue);
  const idleMoney = notSold.reduce((s, p) => s + p.stockValue, 0);

  const href = (extra: Record<string, string>) => {
    const sp = new URLSearchParams({ periodo: period, ...(byUnits ? { orden: "unidades" } : {}), ...extra });
    return `/admin/ventas/productos?${sp}`;
  };

  return (
    <>
      <PageHeader title="Ventas" description={`Productos · del ${shortDay(range.from)} al ${shortDay(range.to)}`} />
      <SalesTabs current="productos" />

      <div className="mb-6 flex flex-wrap gap-2">
        {Object.entries(PERIODS).map(([key, label]) => (
          <Link
            key={key}
            href={href({ periodo: key })}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${
              period === key ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Productos que se vendieron" value={`${sold.length} de ${all.length}`} />
        <StatCard label="Vendido en productos" value={formatMoney(totalRevenue)} hint="Sin contar envíos ni descuentos" />
        <StatCard label="Sin ventas en el periodo" value={String(notSold.length)} tone={notSold.length ? "warn" : "default"} />
        <StatCard label="Dinero parado en inventario" value={formatMoney(idleMoney)} hint="Existencia de lo que no se vendió, a precio de venta" tone={idleMoney ? "warn" : "default"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3">
            <h2 className="font-extrabold">🏆 Lo más vendido</h2>
            <div className="flex rounded-xl bg-stone-100 p-1 text-xs font-bold">
              <Link href={href({ orden: "dinero" })} className={`rounded-lg px-3 py-1 ${!byUnits ? "bg-white shadow-sm" : "text-stone-500"}`}>
                Por dinero
              </Link>
              <Link href={href({ orden: "unidades" })} className={`rounded-lg px-3 py-1 ${byUnits ? "bg-white shadow-sm" : "text-stone-500"}`}>
                Por piezas
              </Link>
            </div>
          </div>
          {sold.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-stone-500">No hubo ventas en este periodo.</p>
          ) : (
            <ol className="divide-y divide-stone-100">
              {sold.slice(0, 25).map((p, i) => (
                <li key={p.id} className="px-5 py-2.5">
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className={`w-6 text-right font-extrabold tabular-nums ${i < 3 ? "text-amber-500" : "text-stone-400"}`}>{i + 1}</span>
                    <Link href={`/admin/productos/${p.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand-700">
                      {p.category?.emoji} {p.name}
                    </Link>
                    <span className="text-stone-500 tabular-nums">{p.units} pz</span>
                    <span className="w-24 text-right font-bold tabular-nums">{formatMoney(p.revenue)}</span>
                  </div>
                  <div className="mt-1 ml-9 h-1.5 rounded-full bg-stone-100">
                    <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${((byUnits ? p.units : p.revenue) / maxValue) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section className="card overflow-hidden">
            <h2 className="px-5 pt-4 pb-1 font-extrabold">🐢 Se venden poco</h2>
            <p className="px-5 pb-2 text-xs text-stone-500">Sí se vendieron, pero muy poco en este periodo.</p>
            {slow.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-stone-500">—</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {slow.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-2">
                    <Link href={`/admin/productos/${p.id}`} className="min-w-0 flex-1 truncate font-semibold hover:text-brand-700">
                      {p.category?.emoji} {p.name}
                    </Link>
                    <span className="text-stone-500 tabular-nums">{p.units} pz</span>
                    <span className="text-xs text-stone-400 tabular-nums">hay {p.stock}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden ring-amber-200">
            <h2 className="px-5 pt-4 pb-1 font-extrabold">😴 No se vendieron ({notSold.length})</h2>
            <p className="px-5 pb-2 text-xs text-stone-500">Ordenados por el dinero que tienes parado en existencia. Buenos candidatos para una promoción.</p>
            {notSold.length === 0 ? (
              <EmptyState icon="🎉" title="Todo se vendió al menos una vez" />
            ) : (
              <ul className="max-h-[480px] divide-y divide-stone-100 overflow-y-auto text-sm">
                {notSold.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-2">
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/productos/${p.id}`} className="block truncate font-semibold hover:text-brand-700">
                        {p.category?.emoji} {p.name}
                      </Link>
                      <span className="text-xs text-stone-400">Última venta: {daysAgo(p.lastSold)}</span>
                    </span>
                    <span className="text-right text-xs text-stone-500 tabular-nums">
                      hay {p.stock}
                      <span className="block font-bold text-stone-700">{formatMoney(p.stockValue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {notSold.length > 0 && (
              <div className="border-t border-stone-100 px-5 py-3 text-sm">
                <Link href="/admin/promociones" className="font-bold text-brand-700 hover:underline">
                  🎁 Crear una promoción para moverlos →
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
