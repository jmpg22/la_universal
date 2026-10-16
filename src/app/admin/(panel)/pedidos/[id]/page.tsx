import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setOrderStatus } from "@/actions/admin/orders";
import { ConfirmButton, SubmitButton } from "@/components/admin/confirm-button";
import { PrintButton } from "@/components/admin/print-button";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { OrderProgress } from "@/components/order-progress";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CHANNEL_LABEL, DELIVERY_LABEL, PAYMENT_LABEL, STATUS_LABEL, formatDateTime, formatMoney } from "@/lib/format";
import { customerMessage, nextStep } from "@/lib/order-flow";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderDetailPage({ params }: PageProps<"/admin/pedidos/[id]">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const order = await db.order.findUnique({ where: { id }, include: { items: { include: { product: { select: { id: true, stock: true } } } } } });
  if (!order) notFound();

  const next = nextStep(order.status, order.deliveryType);
  const isOpen = order.status !== "CANCELLED" && order.status !== "DELIVERED";
  const otherStatuses = (
    order.deliveryType === "DELIVERY"
      ? (["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const)
      : (["PENDING", "CONFIRMED", "PREPARING", "READY", "DELIVERED"] as const)
  ).filter((s) => s !== order.status && s !== next?.status);
  // Números mexicanos de 10 dígitos: se les antepone 52 para WhatsApp.
  const phoneDigits = order.phone.replace(/\D/g, "");
  const waNumber = phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits;

  return (
    <>
      <PageHeader
        title={`Pedido #${order.id}`}
        description={`${order.channel === "COUNTER" ? "Venta de mostrador" : `Pedido por ${CHANNEL_LABEL[order.channel]}`} · ${formatDateTime(order.createdAt)}${order.locale === "en" ? " · 🇺🇸 Cliente en inglés" : ""}`}
        actions={
          <>
            <PrintButton />
            <Link href={order.channel === "COUNTER" ? "/admin/ventas" : "/admin/pedidos"} className="btn btn-secondary print:hidden">
              ← Volver
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {order.channel !== "COUNTER" && (
            <section className="card space-y-4 p-5 print:hidden">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold">Estado</h2>
                <StatusBadge status={order.status} />
              </div>
              <OrderProgress status={order.status} deliveryType={order.deliveryType} />
              {isOpen && (
                <div className="flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                  {next && (
                    <form action={setOrderStatus.bind(null, order.id, next.status)}>
                      <SubmitButton className="btn btn-primary" pendingText="Actualizando…">
                        {next.label} →
                      </SubmitButton>
                    </form>
                  )}
                  {otherStatuses.map((s) => (
                    <form key={s} action={setOrderStatus.bind(null, order.id, s)}>
                      <SubmitButton className="btn btn-secondary">{STATUS_LABEL[s]}</SubmitButton>
                    </form>
                  ))}
                  <form action={setOrderStatus.bind(null, order.id, "CANCELLED")} className="ml-auto">
                    <ConfirmButton message={`¿Cancelar el pedido #${order.id}? Los productos regresarán al inventario.`}>
                      Cancelar pedido
                    </ConfirmButton>
                  </form>
                </div>
              )}
            </section>
          )}

          <section className="card overflow-hidden">
            <h2 className="px-5 pt-4 font-extrabold">Productos</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-bold tracking-wide text-stone-500 uppercase">
                <tr>
                  <th className="px-5 py-2">Cant.</th>
                  <th className="px-5 py-2">Producto</th>
                  <th className="px-5 py-2 text-right">Precio</th>
                  <th className="px-5 py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-2 text-lg font-extrabold tabular-nums">{item.quantity}</td>
                    <td className="px-5 py-2 font-semibold">
                      {item.product ? (
                        <Link href={`/admin/productos/${item.product.id}`} className="hover:text-brand-700">
                          {item.name}
                        </Link>
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                    <td className="px-5 py-2 text-right font-semibold tabular-nums">{formatMoney(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-stone-200">
                <tr>
                  <td colSpan={3} className="px-5 pt-3 text-right">Subtotal</td>
                  <td className="px-5 pt-3 text-right tabular-nums">{formatMoney(order.subtotal)}</td>
                </tr>
                {(order.discountDetail ? (JSON.parse(order.discountDetail) as { name: string; amount: number }[]) : []).map((d, i) => (
                  <tr key={i} className="font-semibold text-coral-600">
                    <td colSpan={3} className="px-5 text-right">🎁 {d.name}</td>
                    <td className="px-5 text-right tabular-nums">−{formatMoney(d.amount)}</td>
                  </tr>
                ))}
                {order.deliveryFee > 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 text-right">Envío</td>
                    <td className="px-5 text-right tabular-nums">{formatMoney(order.deliveryFee)}</td>
                  </tr>
                )}
                <tr className="text-lg font-extrabold">
                  <td colSpan={3} className="px-5 pt-1 pb-4 text-right">Total</td>
                  <td className="px-5 pt-1 pb-4 text-right tabular-nums">{formatMoney(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-3 p-5 text-sm">
            <h2 className="font-extrabold">Cliente</h2>
            <p className="text-base font-bold">{order.customerName}</p>
            {order.phone && (
              <p>
                <a href={`tel:${phoneDigits}`} className="font-semibold text-brand-700 hover:underline">
                  📞 {order.phone}
                </a>
              </p>
            )}
            {order.phone && order.channel !== "COUNTER" && (
              <a
                href={whatsappLink(
                  waNumber,
                  customerMessage({ ...order, total: formatMoney(order.total) }),
                )}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary w-full print:hidden"
              >
                Avisar por WhatsApp
              </a>
            )}
          </section>

          <section className="card space-y-2 p-5 text-sm">
            <h2 className="font-extrabold">Entrega y pago</h2>
            <p>
              <span className="font-bold">{DELIVERY_LABEL[order.deliveryType]}</span>
              {order.deliveryType === "DELIVERY" && <span className="mt-1 block whitespace-pre-line text-stone-600">{order.address}</span>}
            </p>
            {order.recipientName && (
              <p className="rounded-lg bg-sky-50 px-3 py-2">
                <span className="font-bold">Recibe:</span> {order.recipientName}
              </p>
            )}
            <p>
              <span className="font-bold">Pago:</span> {PAYMENT_LABEL[order.paymentMethod]}
            </p>
            {order.cashGivenWith != null && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 font-semibold text-amber-900">
                Paga con {formatMoney(order.cashGivenWith)} → llevar cambio de {formatMoney(Math.max(0, order.cashGivenWith - order.total))}
              </p>
            )}
            {order.notes && (
              <p className="rounded-lg bg-stone-50 px-3 py-2">
                <span className="font-bold">Notas:</span> {order.notes}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
