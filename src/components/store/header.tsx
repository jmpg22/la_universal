import Link from "next/link";
import { localePath } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { getSettings, getStorePromotions } from "@/lib/store-data";
import { LanguageSwitch } from "./language-switch";
import { OpenChatButton } from "./open-chat-button";

export async function StoreHeader() {
  const { lang, t } = await getI18n();
  const [settings, promotions] = await Promise.all([getSettings(lang), getStorePromotions(lang)]);
  // El aviso puede armarse solo con las promociones activas (se elige en Ajustes de la web).
  const announcement =
    settings.announcementFromPromos && promotions.length ? `🎁 ${promotions.map((p) => p.name).join(" · ")}` : settings.announcement;

  return (
    <header className="sticky top-0 z-30">
      {!settings.acceptingOrders ? (
        <p className="bg-stone-800 px-4 py-2 text-center text-sm font-semibold text-white">{t.header.closed}</p>
      ) : announcement ? (
        <p className="bg-sun-400 px-4 py-2 text-center text-sm font-bold text-brand-950">{announcement.startsWith("🎁") ? announcement : `✨ ${announcement}`}</p>
      ) : null}

      <div className="border-b border-black/5 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href={localePath(lang, "/")} className="group flex min-w-0 flex-1 items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl shadow-md shadow-brand-700/20 transition group-hover:-rotate-6"
              aria-hidden
            >
              🛒
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-display text-lg font-bold text-brand-800 sm:text-xl">{settings.storeName}</span>
              <span className="hidden truncate text-xs text-stone-500 sm:block">{settings.tagline}</span>
            </span>
          </Link>

          <LanguageSwitch />
          <OpenChatButton className="hidden sm:inline-flex">💬 {t.shop.orderCta}</OpenChatButton>
        </div>
      </div>
    </header>
  );
}
