import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { db } from "@/lib/db";
import { AdminNav } from "./admin-nav";
import { NAV } from "./nav-items";

async function PendingBadge() {
  const pending = await db.order.count({ where: { status: "PENDING" } });
  if (pending === 0) return null;
  return (
    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-amber-950" title="Pedidos nuevos">
      {pending}
    </span>
  );
}

function StaticNav() {
  return (
    <ul className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3">
      {NAV.map((item) => (
        <li key={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap text-brand-100">
          <span aria-hidden>{item.icon}</span> {item.label}
        </li>
      ))}
    </ul>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-100 lg:flex-row">
      <aside className="bg-brand-900 print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/admin" className="flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-lg" aria-hidden>
              🛒
            </span>
            <span className="leading-tight">
              <span className="block font-extrabold">La Universal</span>
              <span className="block text-xs text-brand-300">Administración</span>
            </span>
          </Link>
        </div>
        <nav aria-label="Panel" className="lg:flex-1 lg:overflow-y-auto">
          <Suspense fallback={<StaticNav />}>
            <AdminNav
              pendingBadge={
                <Suspense>
                  <PendingBadge />
                </Suspense>
              }
            />
          </Suspense>
        </nav>
        <div className="hidden gap-2 border-t border-white/10 p-3 lg:flex lg:flex-col">
          <Link href="/" target="_blank" className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-white/10 hover:text-white">
            🌐 Ver tienda
          </Link>
          <form action={logout}>
            <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-brand-100 hover:bg-white/10 hover:text-white">
              🚪 Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        <div className="flex justify-center gap-4 pb-6 text-sm lg:hidden">
          <Link href="/" target="_blank" className="font-semibold text-stone-600">
            Ver tienda
          </Link>
          <form action={logout}>
            <button type="submit" className="font-semibold text-stone-600">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
