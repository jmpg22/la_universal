import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { setOrderStatus } from "@/actions/admin/orders";
import { SubmitButton } from "@/components/admin/confirm-button";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { DELIVERY_LABEL, PAYMENT_LABEL, formatDateTime, formatMoney, formatTime, localDateKey } from "@/lib/format";
import { ACTIVE_STATUSES, nextStep } from "@/lib/order-flow";

export const metadata: Metadata = { title: "Pedidos" };

const TABS = {
  activos: { label: "En curso", where: { status: { in: ACTIVE_STATUSES } } },
  entregados: { label: "Entregados", where: { status: "DELIVERED" } },
  cancelados: { label: "Cancelados", where: { status: "CANCELLED" } },
  todos: { label: "Todos", where: {} },
} satisfies Record<string, { label: string; where: Prisma.OrderWhereInput }>;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  await requireAdmin();
  const params = await searchParams;
  const tab = (typeof params.ver === "string" && params.ver in TABS ? params.ver : "activos") as keyof typeof TABS;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const qNumber = Number(q.replace("#", ""));

  const where: Prisma.OrderWhereInput = {
    ...TABS[tab].where,
    channel: { not: "COUNTER" },
    ...(q && {
      OR: [
        ...(Number.isInteger(qNumber) && qNumber > 0 ? [{ id: qNumber }] : []),
        { customerName: { contains: q } },
        { phone: { contains: q } },
      ],
    }),
  };

  const [orders, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: tab === "activos" ? "asc" : "desc" },
      take: 100,
      include: { _count: { select: { items: true } } },
    }),
    db.order.groupBy({ by: ["status"], where: { channel: { not: "COUNTER" } }, _count: true }),
  ]);
  const countFor = (key: keyof typeof TABS) => {
    if (key === "todos") return counts.reduce((n, c) => n + c._count, 0);
    const statuses = key === "activos" ? ACTIVE_STATUSES : key === "entregados" ? ["DELIVERED"] : ["CANCELLED"];
    return counts.filter((c) => statuses.includes(c.status)).reduce((n, c) => n + c._count, 0);
  };
  const today = localDateKey(new Date());

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader title="Pedidos" description="Esta página se actualiza sola cada 30 segundos." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TABS).map(([key, t]) => (
            <Link
              key={key}
              href={`/admin/pedidos${key === "activos" ? "" : `?ver=${key}`}`}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${
                tab === key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
              }`}
            >
              {t.label} <span className="opacity-70">{countFor(key as keyof typeof TABS)}</span>
            </Link>
          ))}
        </div>
        <Form action="/admin/pedidos" className="flex gap-2">
          {tab !== "activos" && <input type="hidden" name="ver" value={tab} />}
          <input name="q" defaultValue={q} placeholder="# pedido, nombre o teléfono" className="input w-56" />
          <button type="submit" className="btn btn-secondary">
            Buscar
          </button>
        </Form>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon="🧾" title={tab === "activos" ? "No hay pedidos en curso" : "No hay pedidos"}>
          {tab === "activos" && "Los pedidos nuevos de la tienda aparecerán aquí."}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => {
            const next = nextStep(o.status, o.deliveryType);
            return (
              <li key={o.id} className={`card flex flex-col p-4 ${o.status === "PENDING" ? "ring-2 ring-amber-400" : ""}`}>
                <Link href={`/admin/pedidos/${o.id}`} className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-extrabold text-stone-900">#{o.id}</p>
                      <p className="text-xs text-stone-500">
                        {localDateKey(o.createdAt) === today ? `Hoy, ${formatTime(o.createdAt)}` : formatDateTime(o.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-2 font-bold text-stone-800">
                    {o.customerName}
                    {o.channel === "WHATSAPP" && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">💬 WhatsApp</span>}
                  </p>
                  <p className="text-sm text-stone-500">
                    {o.deliveryType === "DELIVERY" ? "🛵" : "🏪"} {DELIVERY_LABEL[o.deliveryType]} · {PAYMENT_LABEL[o.paymentMethod]}
                  </p>
                  {o.deliveryType === "DELIVERY" && <p className="mt-1 line-clamp-1 text-sm text-stone-500">{o.address}</p>}
                  <p className="mt-2 flex justify-between text-sm">
                    <span className="text-stone-500">{o._count.items} {o._count.items === 1 ? "producto" : "productos"}</span>
                    <span className="font-extrabold tabular-nums">{formatMoney(o.total)}</span>
                  </p>
                </Link>
                {next && (
                  <form action={setOrderStatus.bind(null, o.id, next.status)} className="mt-3">
                    <SubmitButton className="btn btn-primary w-full" pendingText="Actualizando…">
                      {next.label}
                    </SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
