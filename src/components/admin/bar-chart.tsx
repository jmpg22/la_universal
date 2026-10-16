"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

export type BarDatum = { key: string; label: string; value: number; detail?: string };

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max / 1)!;
  return step * pow;
}

/**
 * Columnas de una sola serie con tooltip al pasar el cursor (o enfocar con teclado)
 * y una tabla con los mismos datos para lectores de pantalla.
 */
export function BarChart({
  data,
  kind = "money",
  height = 200,
  title,
}: {
  data: BarDatum[];
  kind?: "money" | "count";
  height?: number;
  title: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const format = (v: number) =>
    kind === "money" ? formatMoney(v).replace(/\.00$/, "") : new Intl.NumberFormat("es-MX").format(v);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.ceil(data.length / 10);
  const hovered = active != null ? data[active] : null;

  return (
    <figure>
      <div className="relative flex gap-2" style={{ height }}>
        <div className="flex w-14 shrink-0 flex-col justify-between text-right text-[11px] text-stone-400 tabular-nums" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute right-0 left-0 border-t border-stone-200" style={{ top: `${(1 - t / max) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end" role="presentation">
            {data.map((d, i) => (
              <button
                key={d.key}
                type="button"
                aria-label={`${d.label}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group flex h-full flex-1 items-end justify-center px-px outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t transition-colors ${active === i ? "bg-brand-700" : "bg-brand-500"} group-focus-visible:ring-2 group-focus-visible:ring-brand-300`}
                  style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                />
              </button>
            ))}
          </div>
          {hovered && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-stone-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
              style={{ left: `${((active! + 0.5) / data.length) * 100}%` }}
            >
              <p className="font-bold">{hovered.label}</p>
              <p className="tabular-nums">{format(hovered.value)}</p>
              {hovered.detail && <p className="text-stone-300">{hovered.detail}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex gap-2" aria-hidden>
        <div className="w-14 shrink-0" />
        <div className="flex flex-1">
          {data.map((d, i) => (
            <span key={d.key} className="flex-1 truncate text-center text-[11px] text-stone-400">
              {i % labelEvery === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-stone-500">Ver como tabla</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">{title}</caption>
          <tbody className="divide-y divide-stone-100">
            {data.map((d) => (
              <tr key={d.key}>
                <td className="py-1 text-stone-600">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
                <td className="py-1 text-right text-stone-500">{d.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
