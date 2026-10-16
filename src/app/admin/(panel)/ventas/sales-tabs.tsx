import Link from "next/link";

/** Pestañas de la sección Ventas: periodos rápidos, rango personalizado y productos. */
export function SalesTabs({ current }: { current: "hoy" | "semana" | "mes" | "rango" | "productos" }) {
  const tabs = [
    { key: "hoy", label: "Hoy", href: "/admin/ventas?periodo=hoy" },
    { key: "semana", label: "Esta semana", href: "/admin/ventas?periodo=semana" },
    { key: "mes", label: "Este mes", href: "/admin/ventas?periodo=mes" },
    { key: "rango", label: "Otras fechas", href: "/admin/ventas?periodo=rango" },
    { key: "productos", label: "📦 Productos", href: "/admin/ventas/productos" },
  ] as const;
  return (
    <nav aria-label="Secciones de ventas" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap ring-1 transition ${
            current === t.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-stone-600 ring-stone-200 hover:ring-stone-300"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
