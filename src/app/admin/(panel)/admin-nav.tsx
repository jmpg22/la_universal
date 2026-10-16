"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav-items";

export function AdminNav({ pendingBadge }: { pendingBadge?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ul className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                active ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {"badge" in item && pendingBadge}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
