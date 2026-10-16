import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { type Locale, pick } from "@/lib/i18n/config";
import { getDictionary, unitLabel } from "@/lib/i18n/dictionaries";
import { matchesQuery } from "@/lib/search";

// Etiquetas de caché. Las acciones del panel llaman updateTag() con ellas después de cada cambio.
export const TAG = {
  products: "products",
  categories: "categories",
  settings: "settings",
  promotions: "promotions",
} as const;

const productSelect = {
  id: true,
  name: true,
  nameEn: true,
  slug: true,
  description: true,
  descriptionEn: true,
  price: true,
  compareAtPrice: true,
  unit: true,
  stock: true,
  imageUrl: true,
  featured: true,
  category: { select: { name: true, nameEn: true, slug: true, emoji: true } },
} as const;

/** Producto ya traducido al idioma de la página. */
export type StoreProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  unit: string;
  stock: number;
  imageUrl: string | null;
  featured: boolean;
  category: { name: string; slug: string; emoji: string } | null;
};

// ---- Datos en caché (ambos idiomas) ----

async function getRawSettings() {
  "use cache";
  cacheLife("max");
  cacheTag(TAG.settings);
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

async function getRawCategories() {
  "use cache";
  cacheLife("max");
  cacheTag(TAG.categories, TAG.products);
  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nameEn: true,
      slug: true,
      emoji: true,
      _count: { select: { products: { where: { active: true } } } },
    },
  });
  return categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

/** Todos los productos visibles. El catálogo de una tienda de barrio cabe sin problema en memoria. */
async function getRawProducts() {
  "use cache";
  cacheLife("max");
  cacheTag(TAG.products, TAG.categories);
  return db.product.findMany({
    where: { active: true, OR: [{ categoryId: null }, { category: { active: true } }] },
    orderBy: { name: "asc" },
    select: productSelect,
  });
}

type RawProduct = Awaited<ReturnType<typeof getRawProducts>>[number];

// ---- Traducción al idioma de la página ----

function localizeProduct(p: RawProduct, lang: Locale): StoreProduct {
  return {
    id: p.id,
    name: pick(lang, p.name, p.nameEn),
    slug: p.slug,
    description: pick(lang, p.description, p.descriptionEn),
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    unit: unitLabel(getDictionary(lang), p.unit),
    stock: p.stock,
    imageUrl: p.imageUrl,
    featured: p.featured,
    category: p.category && {
      name: pick(lang, p.category.name, p.category.nameEn),
      slug: p.category.slug,
      emoji: p.category.emoji,
    },
  };
}

export async function getSettings(lang: Locale) {
  const s = await getRawSettings();
  return {
    ...s,
    tagline: pick(lang, s.tagline, s.taglineEn),
    announcement: pick(lang, s.announcement, s.announcementEn),
    heroTitle: pick(lang, s.heroTitle, s.heroTitleEn),
    heroSubtitle: pick(lang, s.heroSubtitle, s.heroSubtitleEn),
    hours: pick(lang, s.hours, s.hoursEn),
    deliveryArea: pick(lang, s.deliveryArea, s.deliveryAreaEn),
    chatWelcome: pick(lang, s.chatWelcome, s.chatWelcomeEn),
  };
}

export type StoreSettings = Awaited<ReturnType<typeof getRawSettings>>;

export async function getCategories(lang: Locale) {
  const categories = await getRawCategories();
  return categories.map((c) => ({ ...c, name: pick(lang, c.name, c.nameEn) }));
}

export async function getAllProducts(lang: Locale) {
  return (await getRawProducts()).map((p) => localizeProduct(p, lang));
}

/** Busca en ambos idiomas: "leche" y "milk" encuentran lo mismo. */
export async function searchProducts({ category, q, lang }: { category?: string; q?: string; lang: Locale }) {
  const raw = await getRawProducts();
  return raw
    .filter(
      (p) =>
        (!category || p.category?.slug === category) &&
        matchesQuery(
          `${p.name} ${p.nameEn} ${p.description} ${p.descriptionEn} ${p.category?.name ?? ""} ${p.category?.nameEn ?? ""}`,
          q ?? "",
        ),
    )
    .map((p) => localizeProduct(p, lang));
}

export async function getFeaturedProducts(lang: Locale) {
  const all = await getAllProducts(lang);
  return all.filter((p) => p.featured && p.stock > 0).slice(0, 8);
}

export async function getOffers(lang: Locale) {
  const all = await getAllProducts(lang);
  return all.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price && p.stock > 0).slice(0, 8);
}

/** Nombre, precio y existencia actuales por id, para refrescar el carrito del navegador. */
export async function getCatalogSnapshot(lang: Locale) {
  const all = await getAllProducts(lang);
  return Object.fromEntries(all.map((p) => [p.id, { name: p.name, unit: p.unit, price: p.price, stock: p.stock }]));
}

export async function getProductBySlug(slug: string, lang: Locale) {
  const raw = (await getRawProducts()).find((p) => p.slug === slug);
  return raw ? localizeProduct(raw, lang) : null;
}

/** Catálogo agrupado por categoría para la portada. La búsqueda funciona en español e inglés. */
export async function getCatalog(lang: Locale) {
  const [raw, categories] = await Promise.all([getRawProducts(), getRawCategories()]);
  const products = raw.map((p) => ({
    ...localizeProduct(p, lang),
    categorySlug: p.category?.slug ?? "",
    searchText: `${p.name} ${p.nameEn} ${p.description} ${p.descriptionEn} ${p.category?.name ?? ""} ${p.category?.nameEn ?? ""}`,
  }));
  const sections = categories
    .map((c) => ({
      slug: c.slug,
      name: pick(lang, c.name, c.nameEn),
      emoji: c.emoji,
      products: products.filter((p) => p.categorySlug === c.slug),
    }))
    .filter((s) => s.products.length > 0);
  const uncategorized = products.filter((p) => !p.categorySlug);
  if (uncategorized.length) {
    sections.push({ slug: "otros", name: lang === "en" ? "Other" : "Otros", emoji: "🛍️", products: uncategorized });
  }
  // Los agotados van al final de cada categoría.
  for (const s of sections) s.products.sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0));
  const offers = products.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price && p.stock > 0);
  return { sections, offers, total: products.length };
}

/** Promociones activas para mostrarlas en la portada (el cálculo de descuentos vive en lib/promotions). */
export async function getStorePromotions(lang: Locale) {
  "use cache";
  cacheLife("max");
  cacheTag(TAG.promotions, TAG.categories);
  const promos = await db.promotion.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, nameEn: true },
  });
  return promos.map((p) => ({ id: p.id, name: pick(lang, p.name, p.nameEn) }));
}
