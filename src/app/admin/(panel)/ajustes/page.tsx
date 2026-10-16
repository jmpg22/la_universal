import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { isClaudeConfigured } from "@/lib/anthropic";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PasswordForm } from "./password-form";
import { SettingsForm } from "./settings-form";
import { TranslateButton } from "./translate-button";

export const metadata: Metadata = { title: "Ajustes de la web" };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [settings, productsMissing, categoriesMissing] = await Promise.all([
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.product.count({ where: { OR: [{ nameEn: "" }, { AND: [{ descriptionEn: "" }, { NOT: { description: "" } }] }] } }),
    db.category.count({ where: { nameEn: "" } }),
  ]);
  const missing = productsMissing + categoriesMissing;

  return (
    <>
      <PageHeader title="Ajustes de la web" description="Lo que cambies aquí se refleja de inmediato en la tienda en línea." />
      <SettingsForm settings={settings} />

      <section className="card mt-8 max-w-3xl space-y-3 p-5">
        <h2 className="font-extrabold">🇺🇸 Tienda en inglés</h2>
        <p className="text-sm text-stone-600">
          Los clientes pueden cambiar la tienda a inglés con el botón de arriba. Los botones y avisos ya están traducidos; los nombres de
          productos, categorías y los textos de la portada se traducen con IA. Lo que escribas a mano en inglés nunca se reemplaza.
        </p>
        <p className="text-sm text-stone-600">
          {missing === 0
            ? "✅ Todos los productos y categorías tienen nombre en inglés."
            : `Faltan por traducir: ${productsMissing} productos y ${categoriesMissing} categorías.`}
        </p>
        {isClaudeConfigured() ? (
          <TranslateButton missing={missing} />
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Para traducir con IA agrega ANTHROPIC_API_KEY en .env.
          </p>
        )}
      </section>

      <section className="card mt-8 max-w-xl p-5">
        <h2 className="font-extrabold">Tu cuenta</h2>
        <p className="mb-4 text-sm text-stone-500">
          {admin.name} · {admin.email}
        </p>
        <PasswordForm />
      </section>
    </>
  );
}
