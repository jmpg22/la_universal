import type { Metadata, Viewport } from "next";
import { ChatPanel, OrderFab } from "@/components/store/chat-panel";
import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";
import { OrderChatProvider } from "@/components/store/order-chat-context";
import { INTL_LOCALE, LOCALES } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import { getAllProducts, getSettings } from "@/lib/store-data";
import { fredoka, nunito } from "../fonts";
import "../globals.css";

// Layout raíz de la tienda. El idioma viene del segmento [lang]: "es" (sin prefijo en la URL) o "en".
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getI18n();
  return {
    title: { default: "Abarrotes La Universal", template: "%s · La Universal" },
    description: t.meta.description,
    alternates: { languages: { "es-MX": "/", "en-US": "/en" } },
    openGraph: { locale: INTL_LOCALE[lang] },
  };
}

export const viewport: Viewport = {
  themeColor: "#166342",
  viewportFit: "cover",
};

export default async function StoreRootLayout({ children }: LayoutProps<"/[lang]">) {
  const { lang } = await getI18n();
  const [settings, products] = await Promise.all([getSettings(lang), getAllProducts(lang)]);

  return (
    <html lang={INTL_LOCALE[lang]} className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider lang={lang}>
          <OrderChatProvider
            storeName={settings.storeName}
            bank={{
              bankName: settings.bankName,
              bankAccountHolder: settings.bankAccountHolder,
              bankAccount: settings.bankAccount,
              bankClabe: settings.bankClabe,
              bankCard: settings.bankCard,
              bankNote: settings.bankNote,
            }}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              unit: p.unit,
              emoji: p.category?.emoji ?? "🛒",
              imageUrl: p.imageUrl,
              stock: p.stock,
            }))}
          >
            <StoreHeader />
            <main className="flex-1 pb-24">{children}</main>
            <StoreFooter />
            <OrderFab />
            <ChatPanel />
          </OrderChatProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
