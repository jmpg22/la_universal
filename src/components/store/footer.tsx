import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/store-data";
import { whatsappLink } from "@/lib/whatsapp";
import { OpenChatButton } from "./open-chat-button";

export async function StoreFooter() {
  const { lang, t } = await getI18n();
  const s = await getSettings(lang);
  const mapsUrl = s.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}` : null;

  return (
    <footer className="relative mt-16 overflow-hidden bg-brand-950 text-brand-50">
      <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 py-12">
        <div className="mb-10 flex flex-col items-center justify-between gap-4 rounded-3xl bg-brand-800/60 p-6 text-center ring-1 ring-white/10 md:flex-row md:text-left">
          <div>
            <p className="font-display text-2xl font-bold text-white">{t.shop.stepsTitle}</p>
            <p className="text-brand-200">{t.shop.steps[0].text}</p>
          </div>
          <OpenChatButton variant="sun" className="shrink-0">
            💬 {t.shop.orderCta}
          </OpenChatButton>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-display text-xl font-bold text-white">
              <span aria-hidden>🛒</span> {s.storeName}
            </p>
            <p className="mt-2 text-sm text-brand-200">{s.tagline}</p>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="font-bold text-white">{t.footer.visit}</p>
            {s.address &&
              (mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="block hover:text-white hover:underline">
                  📍 {s.address}
                </a>
              ) : (
                <p>📍 {s.address}</p>
              ))}
            {s.hours && <p>🕒 {s.hours}</p>}
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="font-bold text-white">{t.footer.contact}</p>
            {s.phone && (
              <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="block hover:text-white hover:underline">
                📞 {s.phone}
              </a>
            )}
            {s.whatsapp && (
              <a href={whatsappLink(s.whatsapp)} target="_blank" rel="noreferrer" className="block hover:text-white hover:underline">
                💬 {t.footer.whatsapp}
              </a>
            )}
            {s.email && (
              <a href={`mailto:${s.email}`} className="block hover:text-white hover:underline">
                ✉️ {s.email}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/10 py-5 text-center text-xs text-brand-300">
        © {s.storeName}
      </div>
    </footer>
  );
}
