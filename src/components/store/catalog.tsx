"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { matchesQuery } from "@/lib/search";
import type { StoreProduct } from "@/lib/store-data";
import { OpenChatButton } from "./open-chat-button";
import { ProductCard } from "./product-card";

export type CatalogProduct = StoreProduct & { searchText: string };
export type CatalogSection = { slug: string; name: string; emoji: string; products: CatalogProduct[] };

function Grid({ products }: { products: CatalogProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

/** Catálogo completo por categoría, con búsqueda instantánea y barra de categorías que sigue el scroll. */
export function Catalog({ sections, offers }: { sections: CatalogSection[]; offers: CatalogProduct[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(offers.length ? "ofertas" : (sections[0]?.slug ?? ""));
  const chipsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // ?q= en la URL (enlaces viejos o compartidos) llena la búsqueda.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la URL solo se puede leer en el navegador
    if (q) setQuery(q);
  }, []);

  // La barra de búsqueda se pega justo debajo del encabezado, mida lo que mida.
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header || !barRef.current) return;
    const bar = barRef.current;
    const update = () => bar.style.setProperty("top", `${header.getBoundingClientRect().height}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    const all = sections.flatMap((s) => s.products);
    return all.filter((p) => matchesQuery(p.searchText, query));
  }, [query, searching, sections]);

  // Resalta la categoría que está en pantalla.
  useEffect(() => {
    if (searching) return;
    const els = [...document.querySelectorAll<HTMLElement>("[data-section]")];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.getAttribute("data-section") ?? "");
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [searching]);

  useEffect(() => {
    const chip = chipsRef.current?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  const chips = [...(offers.length ? [{ slug: "ofertas", name: t.shop.offers, emoji: "🔥" }] : []), ...sections];

  return (
    <section id="catalogo" aria-label={t.shop.catalogTitle} className="relative">
      <div ref={barRef} className="sticky z-20 border-b border-black/5 bg-cream/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg" aria-hidden>
              🔎
            </span>
            <label htmlFor="buscar" className="sr-only">
              {t.shop.searchPlaceholder}
            </label>
            <input
              id="buscar"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.shop.searchPlaceholder}
              className="w-full rounded-full border-0 bg-white py-3.5 pr-12 pl-12 text-base shadow-sm ring-1 ring-black/10 placeholder:text-stone-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t.shop.clearSearch}
                className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200"
              >
                ✕
              </button>
            )}
          </div>
          {!searching && (
            <nav aria-label={t.header.categories}>
              <div ref={chipsRef} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {chips.map((c) => (
                  <a
                    key={c.slug}
                    href={`#cat-${c.slug}`}
                    data-chip={c.slug}
                    aria-current={active === c.slug ? "true" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition ${
                      active === c.slug
                        ? "bg-brand-600 text-white shadow-md shadow-brand-700/20"
                        : "bg-white text-stone-700 ring-1 ring-black/10 hover:ring-brand-300"
                    }`}
                  >
                    <span aria-hidden>{c.emoji}</span> {c.name}
                  </a>
                ))}
              </div>
            </nav>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {searching ? (
          results.length > 0 ? (
            <div className="space-y-4">
              <p className="font-display text-xl font-semibold text-stone-800">{t.shop.results(results.length, query.trim())}</p>
              <Grid products={results} />
            </div>
          ) : (
            <div className="mx-auto max-w-md rounded-3xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-black/5">
              <p className="text-5xl" aria-hidden>
                🤔
              </p>
              <p className="mt-3 font-display text-xl font-semibold text-stone-800">{t.shop.noResults(query.trim())}</p>
              <p className="mt-2 text-sm text-stone-500">{t.shop.noResultsHint}</p>
              <OpenChatButton className="mt-5">💬 {t.shop.askInChat}</OpenChatButton>
            </div>
          )
        ) : (
          <div className="space-y-12">
            {offers.length > 0 && (
              <section id="cat-ofertas" data-section="ofertas" className="scroll-mt-48 rounded-[2rem] bg-gradient-to-br from-coral-100 to-sun-100 p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-stone-900 sm:text-3xl">
                  <span aria-hidden>🔥</span> {t.shop.offers}
                </h2>
                <Grid products={offers} />
              </section>
            )}
            {sections.map((s) => (
              <section key={s.slug} id={`cat-${s.slug}`} data-section={s.slug} className="scroll-mt-48">
                <h2 className="mb-4 flex items-center gap-3 font-display text-2xl font-bold text-stone-900 sm:text-3xl">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-black/5" aria-hidden>
                    {s.emoji}
                  </span>
                  {s.name}
                  <span className="text-sm font-semibold text-stone-400">{s.products.length}</span>
                </h2>
                <Grid products={s.products} />
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
