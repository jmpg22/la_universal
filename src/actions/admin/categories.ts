"use server";

import { refresh, revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { TAG } from "@/lib/store-data";
import { translateToEnglish } from "@/lib/translate";
import { isClaudeConfigured } from "@/lib/anthropic";

export type CategoryState = { error?: string; ok?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la categoría").max(60),
  nameEn: z.string().trim().max(60),
  emoji: z.string().trim().max(8),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

async function uniqueSlug(name: string, ignoreId?: number) {
  const root = slugify(name) || "categoria";
  for (let i = 0; ; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const found = await db.category.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === ignoreId) return slug;
  }
}

export async function saveCategory(_prev: CategoryState, formData: FormData): Promise<CategoryState> {
  await requireAdmin();
  const id = Number(formData.get("id")) || undefined;
  const parsed = schema.safeParse({
    name: formData.get("name"),
    nameEn: formData.get("nameEn") ?? "",
    emoji: formData.get("emoji") || "🛒",
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, emoji, sortOrder } = parsed.data;
  let { nameEn } = parsed.data;
  const active = formData.get("active") === "on";

  let savedId = id ?? 0;
  if (id) {
    const current = await db.category.findUnique({ where: { id } });
    if (!current) return { error: "La categoría ya no existe." };
    const slug = current.name === name ? current.slug : await uniqueSlug(name, id);
    if (current.name !== name && nameEn === current.nameEn) nameEn = ""; // la traducción vieja ya no aplica
    await db.category.update({ where: { id }, data: { name, nameEn, emoji, sortOrder, active, slug } });
  } else {
    const created = await db.category.create({ data: { name, nameEn, emoji, sortOrder, active: true, slug: await uniqueSlug(name) } });
    savedId = created.id;
  }
  if (!nameEn && isClaudeConfigured()) {
    const categoryId = savedId;
    after(async () => {
      try {
        const en = (await translateToEnglish({ name })).get("name");
        if (!en) return;
        await db.category.update({ where: { id: categoryId }, data: { nameEn: en } });
        revalidateTag(TAG.categories, "max");
      } catch (e) {
        console.error("[traducción] categoría", categoryId, e);
      }
    });
  }
  updateTag(TAG.categories);
  refresh();
  return { ok: id ? "Guardado" : `Se creó “${name}”` };
}

export async function deleteCategory(id: number) {
  await requireAdmin();
  // Los productos de la categoría quedan "sin categoría" (no se borran).
  await db.category.delete({ where: { id } });
  updateTag(TAG.categories);
  refresh();
}
