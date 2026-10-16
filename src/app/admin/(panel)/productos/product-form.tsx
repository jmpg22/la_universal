"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { saveProduct } from "@/actions/admin/products";
import { FormMessage } from "@/components/admin/ui";
import { ProductImage } from "@/components/store/product-image";
import { UNITS, centsToInput } from "@/lib/format";

type Category = { id: number; name: string; emoji: string };
export type ProductFormValues = {
  id: number;
  name: string;
  description: string;
  nameEn: string;
  descriptionEn: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  categoryId: number | null;
};

function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs font-semibold text-red-600">{error}</p> : hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export function ProductForm({ product, categories }: { product?: ProductFormValues; categories: Category[] }) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const [preview, setPreview] = useState<string | null>(product?.imageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const err = state?.fieldErrors ?? {};
  const emoji = categories.find((c) => c.id === product?.categoryId)?.emoji;

  return (
    <form
      action={action}
      // Una vez hidratado, se envía manualmente para que React no limpie el formulario si el servidor regresa un error.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="grid items-start gap-6 lg:grid-cols-[1fr_320px]"
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <Field label="Nombre" htmlFor="name" error={err.name}>
            <input id="name" name="name" required defaultValue={product?.name} className="input" placeholder="Ej. Leche entera 1 L" />
          </Field>
          <Field label="Descripción (opcional)" htmlFor="description">
            <textarea id="description" name="description" rows={3} defaultValue={product?.description} className="input" />
          </Field>
          <details className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200" open={Boolean(product?.nameEn)}>
            <summary className="cursor-pointer text-sm font-bold text-stone-700">🇺🇸 En inglés (para clientes extranjeros)</summary>
            <p className="mt-1 mb-3 text-xs text-stone-500">Si lo dejas vacío, se traduce automáticamente con IA al guardar.</p>
            <div className="space-y-3">
              <Field label="Nombre en inglés" htmlFor="nameEn" error={err.nameEn}>
                <input id="nameEn" name="nameEn" defaultValue={product?.nameEn} className="input" placeholder="Ej. Whole milk 1 L" />
              </Field>
              <Field label="Descripción en inglés" htmlFor="descriptionEn">
                <textarea id="descriptionEn" name="descriptionEn" rows={2} defaultValue={product?.descriptionEn} className="input" />
              </Field>
            </div>
          </details>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría" htmlFor="categoryId">
              <select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""} className="input">
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Código / SKU (opcional)" htmlFor="sku" error={err.sku} hint="Código de barras o clave interna">
              <input id="sku" name="sku" defaultValue={product?.sku ?? ""} className="input" />
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-extrabold">Precio</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Precio de venta ($)" htmlFor="price" error={err.price}>
              <input id="price" name="price" inputMode="decimal" required defaultValue={centsToInput(product?.price)} className="input" placeholder="0.00" />
            </Field>
            <Field label="Precio anterior ($)" htmlFor="compareAtPrice" error={err.compareAtPrice} hint="Si es mayor, se muestra como oferta">
              <input id="compareAtPrice" name="compareAtPrice" inputMode="decimal" defaultValue={centsToInput(product?.compareAtPrice)} className="input" placeholder="Opcional" />
            </Field>
            <Field label="Se vende por" htmlFor="unit">
              <select id="unit" name="unit" defaultValue={product?.unit ?? "pieza"} className="input">
                {[...new Set([...UNITS, product?.unit ?? "pieza"])].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-extrabold">Inventario</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={product ? "Existencia actual" : "Existencia inicial"}
              htmlFor="stock"
              error={err.stock}
              hint={product ? "Si la cambias se registra como ajuste. Para entradas de mercancía usa Inventario." : undefined}
            >
              <input id="stock" name="stock" type="number" min={0} step={1} defaultValue={product?.stock ?? 0} className="input" />
            </Field>
            <Field label="Avisarme cuando queden" htmlFor="lowStockThreshold" error={err.lowStockThreshold} hint="Aparece en alertas de stock bajo">
              <input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} step={1} defaultValue={product?.lowStockThreshold ?? 5} className="input" />
            </Field>
          </div>
        </section>
      </div>

      <div className="space-y-6 lg:sticky lg:top-6">
        <section className="card space-y-3 p-5">
          <h2 className="font-extrabold">Foto</h2>
          <ProductImage
            name="Vista previa"
            imageUrl={removeImage ? null : preview}
            emoji={emoji}
            seed={product?.id ?? 0}
            className="aspect-square w-full rounded-xl"
            emojiClassName="text-7xl"
          />
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-bold file:text-brand-700"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setPreview(URL.createObjectURL(file));
                setRemoveImage(false);
              }
            }}
          />
          {err.image && <p className="text-xs font-semibold text-red-600">{err.image}</p>}
          <Field label="…o pega la URL de una imagen" htmlFor="imageUrl" error={err.imageUrl}>
            <input id="imageUrl" name="imageUrl" defaultValue={product?.imageUrl?.startsWith("http") ? product.imageUrl : ""} className="input" placeholder="https://" />
          </Field>
          {product?.imageUrl && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="removeImage" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} className="accent-brand-600" />
              Quitar la foto
            </label>
          )}
        </section>

        <section className="card space-y-3 p-5">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="mt-1 accent-brand-600" />
            <span>
              <span className="block text-sm font-bold">Visible en la tienda</span>
              <span className="block text-xs text-stone-500">Si lo desactivas, los clientes no lo verán.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} className="mt-1 accent-brand-600" />
            <span>
              <span className="block text-sm font-bold">Destacado</span>
              <span className="block text-xs text-stone-500">Aparece en “Lo más pedido” de la portada.</span>
            </span>
          </label>
        </section>

        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary flex-1">
            {pending ? "Guardando…" : "Guardar producto"}
          </button>
          <Link href="/admin/productos" className="btn btn-secondary">
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}
