import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
export const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 4 * 1024 * 1024;

export class UploadError extends Error {}

/** Guarda una imagen subida y devuelve la URL pública (/uploads/…). */
export async function saveImage(file: File) {
  const ext = UPLOAD_TYPES[file.type];
  if (!ext) throw new UploadError("La foto debe ser JPG, PNG, WEBP o GIF.");
  if (file.size > MAX_BYTES) throw new UploadError("La foto pesa más de 4 MB.");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

/** Borra una imagen subida previamente; ignora URLs externas. */
export async function deleteImage(url: string | null | undefined) {
  if (!url?.startsWith("/uploads/")) return;
  const name = path.basename(url);
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}
