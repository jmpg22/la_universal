import { Catalog } from "@/components/store/catalog";
import { OpenChatButton } from "@/components/store/open-chat-button";
import { formatMoney } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { getCatalog, getSettings, getStorePromotions } from "@/lib/store-data";

function HeroChatPreview({ you, bot, total }: { you: string; bot: string; total: string }) {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <span className="absolute -top-6 -left-4 animate-float text-5xl">🥑</span>
      <span className="absolute top-24 -right-3 animate-float text-4xl [animation-delay:-2s]">🥛</span>
      <span className="absolute -bottom-6 left-8 animate-float text-5xl [animation-delay:-4s]">🍞</span>
      <div className="relative space-y-3 rounded-[2rem] bg-white/95 p-4 text-left shadow-2xl shadow-brand-950/30 ring-1 ring-white/50 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun-400 text-lg">🛒</span>
          <span className="text-sm font-bold text-stone-800">La Universal</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-brand-500" />
        </div>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-sm text-white">{you}</p>
        <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-stone-100 px-3 py-2 text-sm text-stone-800">{bot}</p>
        <div className="rounded-2xl bg-brand-50 p-3 text-sm ring-1 ring-brand-200">
          <div className="flex justify-between text-stone-600">
            <span>2 × 🥤</span>
            <span>$40.00</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>1 kg 🥚</span>
            <span>$48.00</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>1 × 🍞</span>
            <span>$52.00</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-brand-200 pt-1 font-display text-lg font-bold text-brand-800">
            <span>{total}</span>
            <span>$140.00</span>
          </div>
          <div className="mt-2 rounded-full bg-brand-600 py-1.5 text-center text-xs font-bold text-white">✅</div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const { lang, t } = await getI18n();
  const [settings, catalog, promotions] = await Promise.all([getSettings(lang), getCatalog(lang), getStorePromotions(lang)]);
  const mapsUrl = settings.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}` : null;

  const info = [
    { icon: "🕒", title: t.shop.infoHours, text: settings.hours },
    settings.deliveryEnabled && {
      icon: "🛵",
      title: t.shop.infoDelivery,
      text:
        settings.freeDeliveryMin > 0
          ? t.home.freeFrom(formatMoney(settings.freeDeliveryMin))
          : t.home.deliveryCost(formatMoney(settings.deliveryFee)),
    },
    { icon: "💵", title: t.shop.infoPayment, text: t.shop.infoPaymentText },
    settings.address && { icon: "📍", title: t.shop.infoAddress, text: settings.address, href: mapsUrl },
  ].filter(Boolean) as { icon: string; title: string; text: string; href?: string | null }[];

  return (
    <>
      {/* Portada */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" aria-hidden />
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-sun-400/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl" aria-hidden />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-16 md:grid-cols-[1.15fr_1fr] md:pt-16 md:pb-20">
          <div className="text-center md:text-left">
            <h1 className="font-display text-4xl leading-[1.05] font-bold text-balance sm:text-5xl lg:text-6xl">{settings.heroTitle}</h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-brand-50 md:mx-0">{settings.heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
              <OpenChatButton variant="sun">💬 {t.shop.orderCta}</OpenChatButton>
              <a href="#catalogo" className="btn rounded-full bg-white/15 px-6 py-3.5 text-base text-white ring-1 ring-white/40 hover:bg-white/25">
                🛍️ {t.shop.browseCta}
              </a>
            </div>
          </div>
          <HeroChatPreview you={t.shop.heroChatYou} bot={t.shop.heroChatBot} total={t.shop.heroChatTotal} />
        </div>

        {/* Ola que une la portada con el contenido */}
        <svg viewBox="0 0 1440 60" className="relative block h-8 w-full text-cream sm:h-12" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0 30c240 30 480 30 720 0s480-30 720 0v30H0z" />
        </svg>
      </section>

      {/* Datos rápidos */}
      <section className="mx-auto -mt-2 max-w-7xl px-4">
        <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {info.map((i) => {
            const body = (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-2xl" aria-hidden>
                  {i.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold tracking-wide text-brand-700 uppercase">{i.title}</span>
                  <span className="block text-sm leading-snug text-stone-700">{i.text}</span>
                  {i.href && <span className="mt-0.5 block text-xs font-bold text-brand-600">{t.shop.directions} →</span>}
                </span>
              </>
            );
            return (
              <li key={i.title} className="w-64 shrink-0 snap-start md:w-auto">
                {i.href ? (
                  <a
                    href={i.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-full items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="flex h-full items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Promociones activas (se administran en el panel) */}
      {promotions.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-8" aria-label={t.shop.promos}>
          <div className="flex flex-col gap-3 rounded-3xl bg-gradient-to-r from-coral-500 to-sun-400 p-1 shadow-lg shadow-coral-500/20 sm:flex-row sm:items-stretch">
            <p className="flex items-center gap-2 px-4 pt-3 font-display text-xl font-bold text-white sm:py-3">
              <span className="text-2xl" aria-hidden>
                🎁
              </span>
              {t.shop.promos}
            </p>
            <ul className="flex flex-1 flex-col gap-2 rounded-[1.25rem] bg-white/95 p-3 sm:flex-row sm:flex-wrap sm:items-center">
              {promotions.map((p) => (
                <li key={p.id} className="rounded-full bg-coral-100 px-4 py-2 text-sm font-bold text-coral-600">
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Cómo funciona */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-6">
        <h2 className="text-center font-display text-3xl font-bold text-stone-900 sm:text-4xl">{t.shop.stepsTitle}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {t.shop.steps.map((step, i) => (
            <li key={step.title} className="relative rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <span className="absolute top-5 right-5 font-display text-5xl font-bold text-brand-100" aria-hidden>
                {i + 1}
              </span>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sun-100 text-3xl" aria-hidden>
                {step.icon}
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-stone-900">{step.title}</h3>
              <p className="mt-1 text-stone-600">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-center">
          <OpenChatButton className="px-8 py-3.5 text-base">💬 {t.shop.orderCta}</OpenChatButton>
        </div>
      </section>

      {/* Catálogo */}
      <div className="mx-auto max-w-7xl px-4 pt-8 pb-2">
        <h2 className="font-display text-3xl font-bold text-stone-900 sm:text-4xl">{t.shop.catalogTitle}</h2>
        <p className="mt-1 text-stone-600">{t.shop.catalogSubtitle}</p>
      </div>
      <Catalog sections={catalog.sections} offers={catalog.offers} />
    </>
  );
}
