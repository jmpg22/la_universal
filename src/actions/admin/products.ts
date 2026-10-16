"use server";

import { refresh, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/format";
import { changeStock } from "@/lib/inventory";
import { slugify } from "@/lib/slug";
import { TAG } from "@/lib/store-data";
import { translateProductIfMissing } from "@/lib/translate";
import { deleteImage, saveImage, UploadError } from "@/lib/uploads";

export type ProductFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const productSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(120),
  description: z.string().trim().max(2000),
  nameEn: z.string().trim().max(120),
  descriptionEn: z.string().trim().max(2000),
  sku: z.string().trim().max(60),
  unit: z.string().trim().min(1).max(30),
  categoryId: z.coerce.number().int().nonnegative(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  stock: z.coerce.number().int("Usa números enteros").min(0, "No puede ser negativo").max(1000000),
  imageUrl: z.string().trim().max(500),
});

async function uniqueSlug(base: string, ignoreId?: number) {
  const root = slugify(base) || "producto";
  for (let i = 0; ; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return slug;
  }
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
  const id = Number(formData.get("id")) || undefined;

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    nameEn: formData.get("nameEn") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    sku: formData.get("sku") ?? "",
    unit: formData.get("unit") || "pieza",
    categoryId: formData.get("categoryId") || 0,
    lowStockThreshold: formData.get("lowStockThreshold") || 0,
    stock: formData.get("stock") || 0,
    imageUrl: formData.get("imageUrl") ?? "",
  });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  }
  const price = parseMoney(formData.get("price"));
  if (price == null || price === 0) fieldErrors.price = "Escribe un precio válido";
  const compareAtPrice = parseMoney(formData.get("compareAtPrice"));
  if (formData.get("compareAtPrice") && compareAtPrice == null) fieldErrors.compareAtPrice = "Precio no válido";
  if (!parsed.success || Object.keys(fieldErrors).length) return { error: "Revisa los campos marcados.", fieldErrors };

  const data = parsed.data;
  if (data.sku) {
    const clash = await db.product.findFirst({ where: { sku: data.sku, NOT: { id } }, select: { id: true } });
    if (clash) return { error: "Revisa los campos marcados.", fieldErrors: { sku: "Ya hay otro producto con ese código" } };
  }

  const existing = id ? await db.product.findUnique({ where: { id } }) : null;
  if (id && !existing) return { error: "El producto ya no existe." };

  // Foto: archivo nuevo > URL escrita > quitar > dejar la actual.
  let imageUrl = existing?.imageUrl ?? null;
  const file = formData.get("image");
  try {
    if (file instanceof File && file.size > 0) imageUrl = await saveImage(file);
    else if (formData.get("removeImage") === "on") imageUrl = null;
    else if (data.imageUrl && data.imageUrl !== existing?.imageUrl) {
      if (!/^https?:\/\//.test(data.imageUrl) && !data.imageUrl.startsWith("/uploads/"))
        return { error: "Revisa los campos marcados.", fieldErrors: { imageUrl: "La URL debe empezar con https://" } };
      imageUrl = data.imageUrl;
    }
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message, fieldErrors: { image: e.message } };
    throw e;
  }

  // Si cambió el texto en español y el inglés se dejó igual, la traducción vieja ya no sirve: se vuelve a traducir.
  const staleName = existing && existing.name !== data.name && data.nameEn === existing.nameEn;
  const staleDescription = existing && existing.description !== data.description && data.descriptionEn === existing.descriptionEn;

  const values = {
    name: data.name,
    description: data.description,
    nameEn: staleName ? "" : data.nameEn,
    descriptionEn: staleDescription ? "" : data.descriptionEn,
    sku: data.sku || null,
    unit: data.unit,
    price: price!,
    compareAtPrice: compareAtPrice && compareAtPrice > price! ? compareAtPrice : null,
    categoryId: data.categoryId || null,
    lowStockThreshold: data.lowStockThreshold,
    imageUrl,
    active: formData.get("active") === "on",
    featured: formData.get("featured") === "on",
  };

  let productId = existing?.id ?? 0;
  if (existing) {
    const slug = existing.name === data.name ? existing.slug : await uniqueSlug(data.name, existing.id);
    await db.$transaction(async (tx) => {
      await tx.product.update({ where: { id: existing.id }, data: { ...values, slug } });
      const diff = data.stock - existing.stock;
      if (diff !== 0) {
        await changeStock(tx, { productId: existing.id, change: diff, reason: "ADJUSTMENT", note: "Editado desde la ficha del producto", allowNegative: true });
      }
    });
    if (imageUrl !== existing.imageUrl) await deleteImage(existing.imageUrl);
  } else {
    const slug = await uniqueSlug(data.name);
    await db.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { ...values, slug, stock: 0 } });
      productId = created.id;
      if (data.stock > 0) {
        await changeStock(tx, { productId: created.id, change: data.stock, reason: "RESTOCK", note: "Inventario inicial" });
      }
    });
  }

  updateTag(TAG.products);
  // Lo que quede sin inglés lo traduce Claude después de responder.
  if (!values.nameEn || (data.description && !values.descriptionEn)) {
    after(async () => {
      try {
        if (await translateProductIfMissing(productId)) revalidateTag(TAG.products, "max");
      } catch (e) {
        console.error("[traducción] producto", productId, e);
      }
    });
  }
  redirect(`/admin/productos?guardado=${encodeURIComponent(data.name)}`);
}

export async function toggleProductActive(id: number) {
  await requireAdmin();
  const product = await db.product.findUniqueOrThrow({ where: { id }, select: { active: true } });
  await db.product.update({ where: { id }, data: { active: !product.active } });
  updateTag(TAG.products);
  refresh();
}

export async function deleteProduct(id: number) {
  await requireAdmin();
  // Los pedidos conservan nombre y precio del producto, así que el historial de ventas no se pierde.
  const product = await db.product.delete({ where: { id } });
  await deleteImage(product.imageUrl);
  updateTag(TAG.products);
  redirect(`/admin/productos?eliminado=${encodeURIComponent(product.name)}`);
}
