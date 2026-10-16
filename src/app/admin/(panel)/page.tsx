import Link from "next/link";
import { setAcceptingOrders } from "@/actions/admin/settings";
import { BarChart } from "@/components/admin/bar-chart";
import { SubmitButton } from "@/components/admin/confirm-button";
import { PageHeader, StatCard, StatusBadge } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, formatMoney, formatTime } from "@/lib/format";
import { ACTIVE_STATUSES } from "@/lib/order-flow";
import { salesReport, shortDay, todayKey } from "@/lib/sales";

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const today = todayKey();

  const [todayReport, yesterdayReport, twoWeeks, activeOrders, products, settings] = await Promise.all([
    salesReport(today, today),
    salesReport(addDays(today, -1), addDays(today, -1)),
    salesReport(addDays(today, -13), today),
    db.order.findMany({
      where: { status: { in: ACTIVE_STATUSES }, channel: { not: "COUNTER" } },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true, stock: true, lowStockThreshold: true } }),
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);

  const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold).sort((a, b) => a.stock - b.stock);
  const pendingCount = activeOrders.filter((o) => o.status === "PENDING").length;
  const diff = todayReport.total - yesterdayReport.total;

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader title={`¡Hola, ${admin.name.split(" ")[0]}!`} description="Así va la tienda hoy." />

      <section className={`card mb-6 flex flex-wrap items-center justify-between gap-3 p-4 ${settings.acceptingOrders ? "" : "bg-amber-50 ring-amber-300"}`}>
        <p className="font-bold">
          {settings.acceptingOrders ? "🟢 Recibiendo pedidos en línea" : "⏸️ Pedidos en línea pausados"}
          <span className="block text-sm font-normal text-stone-500">
            {settings.acceptingOrders ? "Los clientes pueden hacer pedidos desde la web." : "Los clientes ven la tienda pero no pueden pedir."}
          </span>
        </p>
        <form action={setAcceptingOrders.bind(null, !settings.acceptingOrders)}>
          <SubmitButton className={`btn ${settings.acceptingOrders ? "btn-secondary" : "btn-primary"}`}>
            {settings.acceptingOrders ? "Pausar pedidos" : "Reanudar pedidos"}
          </SubmitButton>
        </form>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vendido hoy"
          value={formatMoney(todayReport.total)}
          hint={`${diff >= 0 ? "▲" : "▼"} ${formatMoney(Math.abs(diff))} vs. ayer`}
        />
        <StatCard label="Ventas hoy" value={String(todayReport.count)} hint={`Ticket promedio ${formatMoney(todayReport.average)}`} />
        <StatCard label="Pedidos por atender" value={String(activeOrders.length)} hint={pendingCount ? `${pendingCount} nuevos sin confirmar` : "Ninguno nuevo"} tone={pendingCount ? "warn" : "default"} />
        <StatCard label="Productos por surtir" value={String(lowStock.length)} hint={`${lowStock.filter((p) => p.stock <= 0).length} agotados`} tone={lowStock.length ? "warn" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-extrabold">Ventas de los últimos 14 días</h2>
            <Link href="/admin/ventas" className="text-sm font-bold text-brand-700 hover:underline">
              Ver reporte →
            </Link>
          </div>
          <BarChart
            title="Ventas de los últimos 14 días"
            data={twoWeeks.byDay.map((d) => ({ key: d.key, label: shortDay(d.key), value: d.total, detail: `${d.count} ventas` }))}
          />
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
            <h2 className="font-extrabold">Pedidos por atender</h2>
            <Link href="/admin/pedidos" className="text-sm font-bold text-brand-700 hover:underline">
              Ver todos →
            </Link>
          </div>
          {activeOrders.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-stone-500">No hay pedidos pendientes. 🙌</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {activeOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-stone-50">
                    <span className="font-extrabold">#{o.id}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {o.customerName}
                      <span className="block text-xs text-stone-400">
                        {formatTime(o.createdAt)} · {o.deliveryType === "DELIVERY" ? "🛵 Envío" : "🏪 Recoge"}
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                    <span className="w-20 text-right font-bold tabular-nums">{formatMoney(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
            <h2 className="font-extrabold">Por surtir</h2>
            <Link href="/admin/inventario" className="text-sm font-bold text-brand-700 hover:underline">
              Ir a inventario →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-stone-500">Todo surtido 👌</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lowStock.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-2 text-sm">
                  <Link href={`/admin/inventario?producto=${p.id}`} className="font-semibold hover:text-brand-700">
                    {p.name}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.stock <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {p.stock <= 0 ? "Agotado" : `Quedan ${p.stock}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="px-5 pt-4 pb-2 font-extrabold">Lo más vendido (14 días)</h2>
          {twoWeeks.topProducts.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-stone-500">Aún no hay ventas.</p>
          ) : (
            <ol className="divide-y divide-stone-100">
              {twoWeeks.topProducts.slice(0, 8).map((p, i) => (
                <li key={`${p.productId}-${p.name}`} className="flex items-center gap-3 px-5 py-2 text-sm">
                  <span className="w-5 text-stone-400 tabular-nums">{i + 1}</span>
                  <span className="flex-1 font-semibold">{p.name}</span>
                  <span className="text-stone-500 tabular-nums">{p.quantity} u.</span>
                  <span className="w-20 text-right font-bold tabular-nums">{formatMoney(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/mostrador" className="btn btn-primary">
          💵 Nueva venta de mostrador
        </Link>
        <Link href="/admin/productos/nuevo" className="btn btn-secondary">
          ＋ Agregar producto
        </Link>
        <Link href="/admin/inventario" className="btn btn-secondary">
          📥 Registrar entrada de mercancía
        </Link>
      </div>
    </>
  );
}
