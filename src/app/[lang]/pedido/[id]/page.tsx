import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { OrderProgress } from "@/components/order-progress";
import { BankDetails } from "@/components/store/bank-details";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { INTL_LOCALE, localePath, pick } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/store-data";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.meta.order, robots: { index: false } };
}

export default async function OrderPage({ params, searchParams }: PageProps<"/[lang]/pedido/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { lang, t } = await getI18n();
  const orderId = Number(id);
  const token = typeof query.t === "string" ? query.t : "";
  if (!Number.isInteger(orderId) || !token) notFound();

  const [order, settings] = await Promise.all([
    db.order.findFirst({
      where: { id: orderId, publicToken: token },
      include: { items: { include: { product: { select: { nameEn: true } } } } },
    }),
    getSettings(lang),
  ]);
  if (!order) notFound();

  const itemName = (item: (typeof order.items)[number]) => pick(lang, item.name, item.product?.nameEn);
  const discounts: { name: string; nameEn?: string; amount: number }[] = order.discountDetail ? JSON.parse(order.discountDetail) : [];
  const isNew = query.nuevo === "1";
  const finished = order.status === "DELIVERED" || order.status === "CANCELLED";
  const whatsappText = [
    t.order.whatsappIntro(order.id),
    ...order.items.map((i) => `• ${i.quantity} × ${itemName(i)}`),
    t.order.whatsappTotal(
      formatMoney(order.total),
      t.delivery[order.deliveryType].toLowerCase(),
      t.payment[order.paymentMethod].toLowerCase(),
    ),
    t.order.whatsappName(order.customerName),
  ].join("\n");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {!finished && <AutoRefresh seconds={20} />}

      {isNew && (
        <div className="mb-6 rounded-2xl bg-brand-600 p-6 text-white">
          <p className="text-4xl" aria-hidden>
            🎉
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">{t.order.thanks(order.customerName.split(" ")[0])}</h1>
          <p className="mt-1 text-brand-50">{t.order.saveHint(order.phone)}</p>
        </div>
      )}

      <div className="card space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm text-stone-500">{t.order.order}</p>
            <p className="text-3xl font-extrabold text-stone-900">#{order.id}</p>
            <p className="text-sm text-stone-500">{formatDateTime(order.createdAt, INTL_LOCALE[lang])}</p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-800 ring-1 ring-brand-200">
            {t.status[order.status]}
          </span>
        </div>

        <OrderProgress status={order.status} deliveryType={order.deliveryType} lang={lang} />

        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-bold text-stone-900">{t.delivery[order.deliveryType]}</p>
            <p className="text-stone-600">{order.deliveryType === "DELIVERY" ? order.address : settings.address}</p>
            {order.recipientName && (
              <p className="text-stone-600">
                {t.order.recipient}: {order.recipientName}
              </p>
            )}
          </div>
          <div>
            <p className="font-bold text-stone-900">
              {t.order.payment}: {t.payment[order.paymentMethod]}
            </p>
            {order.cashGivenWith != null && (
              <p className="text-stone-600">
                {t.order.paysWith(formatMoney(order.cashGivenWith), formatMoney(Math.max(0, order.cashGivenWith - order.total)))}
              </p>
            )}
          </div>
        </div>

        {order.paymentMethod === "TRANSFER" && !finished && (
          <BankDetails
            bank={{
              bankName: settings.bankName,
              bankAccountHolder: settings.bankAccountHolder,
              bankAccount: settings.bankAccount,
              bankClabe: settings.bankClabe,
              bankCard: settings.bankCard,
              bankNote: settings.bankNote,
            }}
            total={formatMoney(order.total)}
            orderId={order.id}
          />
        )}

        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>{t.order.product}</th>
              <th>{t.order.amount}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 text-stone-700">
                  {item.quantity} × {itemName(item)}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatMoney(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-stone-200">
            <tr>
              <td className="pt-2">{t.order.subtotal}</td>
              <td className="pt-2 text-right tabular-nums">{formatMoney(order.subtotal)}</td>
            </tr>
            {discounts.map((d, i) => (
              <tr key={i} className="font-semibold text-coral-600">
                <td>🎁 {pick(lang, d.name, d.nameEn)}</td>
                <td className="text-right tabular-nums">−{formatMoney(d.amount)}</td>
              </tr>
            ))}
            {order.deliveryType === "DELIVERY" && (
              <tr>
                <td>{t.order.shipping}</td>
                <td className="text-right tabular-nums">{order.deliveryFee === 0 ? t.order.free : formatMoney(order.deliveryFee)}</td>
              </tr>
            )}
            <tr className="text-lg font-extrabold">
              <td className="pt-1">{t.order.total}</td>
              <td className="pt-1 text-right tabular-nums">{formatMoney(order.total)}</td>
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <span className="font-bold">{t.order.notes}:</span> {order.notes}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {settings.whatsapp && (
          <a href={whatsappLink(settings.whatsapp, whatsappText)} target="_blank" rel="noreferrer" className="btn btn-primary">
            {t.order.sendWhatsapp}
          </a>
        )}
        <Link href={localePath(lang, "/productos")} className="btn btn-secondary">
          {t.order.keepShopping}
        </Link>
      </div>
    </div>
  );
}
