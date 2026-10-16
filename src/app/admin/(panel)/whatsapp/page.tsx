import type { Metadata } from "next";
import Link from "next/link";
import { deleteSimulation, setBotPaused } from "@/actions/admin/whatsapp";
import { ConfirmButton, SubmitButton } from "@/components/admin/confirm-button";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney, formatTime, localDateKey } from "@/lib/format";
import { isBotConfigured } from "@/lib/whatsapp/bot";
import { isWhatsAppConfigured, whatsappConfig } from "@/lib/whatsapp/cloud-api";
import { formatWaId, isSimulated, isWebChat } from "@/lib/whatsapp/phone";
import { ReplyBox, SimulatorBox } from "./composer";

export const metadata: Metadata = { title: "WhatsApp" };

const SENDER_LABEL = { CUSTOMER: "Cliente", BOT: "🤖 Bot", STAFF: "🧑 Tienda", SYSTEM: "🔔 Aviso automático" } as const;

function StatusTick({ status, error }: { status: string; error: string }) {
  const map: Record<string, string> = {
    sent: "✓",
    delivered: "✓✓",
    read: "✓✓ leído",
    failed: "⚠️ no se envió",
    omitido: "⏸ no enviado",
    simulado: "prueba",
  };
  return (
    <span title={error || status} className={status === "failed" || status === "omitido" ? "text-red-600" : ""}>
      {map[status] ?? status}
    </span>
  );
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span aria-hidden>{ok ? "✅" : "⚪"}</span>
      <span>
        <span className="font-bold">{label}</span>
        <span className="block text-xs text-stone-500">{hint}</span>
      </span>
    </li>
  );
}

export default async function WhatsAppPage({ searchParams }: PageProps<"/admin/whatsapp">) {
  await requireAdmin();
  const params = await searchParams;
  const selectedId = Number(params.c) || undefined;

  const [conversations, settings] = await Promise.all([
    db.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 60,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);

  const selected = selectedId
    ? await db.whatsAppConversation.update({
        where: { id: selectedId },
        data: { unread: 0 },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
      }).catch(() => null)
    : null;
  const customer = selected
    ? await db.customer.findUnique({
        where: { phoneKey: selected.phoneKey },
        include: { addresses: { orderBy: { lastUsedAt: "desc" }, take: 5 } },
      })
    : null;
  const orders = selected
    ? await db.order.findMany({ where: { phone: { endsWith: selected.phoneKey } }, orderBy: { createdAt: "desc" }, take: 5 })
    : [];

  let draftItems: { name: string; quantity: number }[] = [];
  if (selected) {
    try {
      const draft = JSON.parse(selected.draft) as { items?: { productId: number; quantity: number }[] };
      const items = draft.items ?? [];
      const products = await db.product.findMany({ where: { id: { in: items.map((i) => i.productId) } }, select: { id: true, name: true } });
      draftItems = items.map((i) => ({ quantity: i.quantity, name: products.find((p) => p.id === i.productId)?.name ?? `#${i.productId}` }));
    } catch {}
  }

  const cfg = whatsappConfig();
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "");
  const waReady = isWhatsAppConfigured();
  const today = localDateKey(new Date());

  return (
    <>
      <AutoRefresh seconds={8} />
      <PageHeader title="Conversaciones" description="Chats de WhatsApp y de la página web. El asistente toma pedidos solo; puedes contestar tú cuando haga falta." />

      <details className="card mb-6 p-4" open={!waReady || !isBotConfigured()}>
        <summary className="cursor-pointer font-extrabold">Estado de la conexión</summary>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <Check ok={waReady} label="WhatsApp Cloud API" hint={waReady ? "Token y número configurados." : "Falta WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env. Mientras tanto todo funciona en modo prueba."} />
          <Check ok={Boolean(cfg.appSecret && cfg.verifyToken)} label="Webhook" hint={siteUrl ? `URL para Meta: ${siteUrl}/api/whatsapp (necesita WHATSAPP_VERIFY_TOKEN y WHATSAPP_APP_SECRET)` : "Configura SITE_URL con tu dominio público para obtener la URL del webhook."} />
          <Check ok={isBotConfigured()} label="Bot con Claude" hint={isBotConfigured() ? `Modelo: ${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"}` : "Falta ANTHROPIC_API_KEY en .env. Sin ella, el bot pasa todos los chats a una persona."} />
          <Check ok={settings.botEnabled} label="Bot activado" hint={settings.botEnabled ? "Contesta y toma pedidos." : "Apagado en Ajustes de la web: solo se reciben mensajes."} />
          <Check ok={Boolean(cfg.orderUpdateTemplate)} label="Plantilla de avisos al cliente" hint="Para avisar a clientes que no han escrito en las últimas 24 h (WHATSAPP_TEMPLATE_ORDER_UPDATE)." />
          <Check ok={Boolean(settings.storeNotifyPhone)} label="Aviso de pedidos a la tienda" hint={settings.storeNotifyPhone ? `Se avisa al ${settings.storeNotifyPhone}.` : "Escribe el número que recibe avisos en Ajustes de la web."} />
        </ul>
      </details>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <h2 className="font-extrabold">Chats</h2>
            <Link href="/admin/whatsapp?c=nuevo" className="text-sm font-bold text-brand-700 hover:underline">
              🧪 Probar bot
            </Link>
          </div>
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-stone-500">Aún no hay conversaciones. Usa “Probar bot” para ver cómo responde.</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-stone-100 overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/whatsapp?c=${c.id}`}
                    className={`block px-4 py-3 hover:bg-stone-50 ${c.id === selected?.id ? "bg-brand-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold">{c.name || formatWaId(c.waId)}</span>
                      <span className="shrink-0 text-xs text-stone-400">
                        {localDateKey(c.lastMessageAt) === today ? formatTime(c.lastMessageAt) : formatDateTime(c.lastMessageAt).split(",")[0]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="flex-1 truncate text-sm text-stone-500">{c.messages[0]?.body ?? ""}</span>
                      {c.unread > 0 && <span className="rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-white">{c.unread}</span>}
                    </div>
                    <div className="mt-1 flex gap-1">
                      {isSimulated(c.waId) && <span className="rounded bg-sky-100 px-1.5 text-[11px] font-bold text-sky-800">Prueba</span>}
                      {isWebChat(c.waId) && <span className="rounded bg-violet-100 px-1.5 text-[11px] font-bold text-violet-800">🌐 Página web</span>}
                      {c.botPaused && <span className="rounded bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">Atiende persona</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-4">
          {params.c === "nuevo" || (!selected && conversations.length === 0) ? (
            <div className="card space-y-3 p-5">
              <h2 className="font-extrabold">🧪 Probar el bot</h2>
              <p className="text-sm text-stone-500">
                Escribe como si fueras un cliente. El bot usa tu catálogo real y, si confirmas, crea un pedido de verdad (puedes cancelarlo
                después). Nada se envía a WhatsApp.
              </p>
              <SimulatorBox />
            </div>
          ) : !selected ? (
            <div className="card p-10 text-center text-stone-500">Elige un chat de la lista.</div>
          ) : (
            <>
              <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-lg font-extrabold">{selected.name || formatWaId(selected.waId)}</p>
                  <p className="text-sm text-stone-500">{isSimulated(selected.waId) ? "Conversación de prueba" : formatWaId(selected.waId)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={setBotPaused.bind(null, selected.id, !selected.botPaused)}>
                    <SubmitButton className={`btn ${selected.botPaused ? "btn-primary" : "btn-secondary"}`}>
                      {selected.botPaused ? "🤖 Reactivar bot" : "✋ Atender yo (pausar bot)"}
                    </SubmitButton>
                  </form>
                  {isSimulated(selected.waId) && (
                    <form action={deleteSimulation.bind(null, selected.id)}>
                      <ConfirmButton message="¿Borrar esta conversación de prueba?">Borrar prueba</ConfirmButton>
                    </form>
                  )}
                </div>
              </div>

              <div className="grid items-start gap-4 xl:grid-cols-[1fr_260px]">
                <div className="card flex flex-col">
                  <ol className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto bg-[#efeae2] p-4">
                    {selected.messages.map((m) => (
                      <li key={m.id} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            m.direction === "OUT" ? (m.sender === "SYSTEM" ? "bg-sky-50" : "bg-[#d9fdd3]") : "bg-white"
                          }`}
                        >
                          {m.direction === "OUT" && <p className="mb-0.5 text-[11px] font-bold text-stone-500">{SENDER_LABEL[m.sender]}</p>}
                          <p className="whitespace-pre-line break-words text-stone-800">{m.body}</p>
                          <p className="mt-1 flex justify-end gap-2 text-[11px] text-stone-400">
                            {formatTime(m.createdAt)}
                            {m.direction === "OUT" && <StatusTick status={m.status} error={m.error} />}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="border-t border-stone-100 p-4">
                    {isSimulated(selected.waId) ? (
                      <SimulatorBox conversationId={selected.id} />
                    ) : (
                      <ReplyBox conversationId={selected.id} botPaused={selected.botPaused} />
                    )}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="card p-4 text-sm">
                    <h3 className="mb-2 font-extrabold">Cliente</h3>
                    {customer?.name ? (
                      <p>
                        Nombre: <span className="font-bold">{customer.name}</span>
                      </p>
                    ) : (
                      <p className="text-stone-500">Aún no se registra (el bot le preguntará su nombre).</p>
                    )}
                    {customer && customer.addresses.length > 0 && (
                      <>
                        <p className="mt-3 mb-1 font-bold">Direcciones usadas</p>
                        <ul className="space-y-1 text-stone-600">
                          {customer.addresses.map((a) => (
                            <li key={a.id}>📍 {a.address}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div className="card p-4 text-sm">
                    <h3 className="mb-2 font-extrabold">Carrito en curso</h3>
                    {draftItems.length === 0 ? (
                      <p className="text-stone-500">Vacío</p>
                    ) : (
                      <ul className="space-y-1">
                        {draftItems.map((i) => (
                          <li key={i.name}>
                            {i.quantity} × {i.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="card p-4 text-sm">
                    <h3 className="mb-2 font-extrabold">Pedidos de este cliente</h3>
                    {orders.length === 0 ? (
                      <p className="text-stone-500">Ninguno</p>
                    ) : (
                      <ul className="space-y-2">
                        {orders.map((o) => (
                          <li key={o.id}>
                            <Link href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between gap-2 hover:text-brand-700">
                              <span className="font-bold">#{o.id}</span>
                              <StatusBadge status={o.status} />
                              <span className="tabular-nums">{formatMoney(o.total)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
