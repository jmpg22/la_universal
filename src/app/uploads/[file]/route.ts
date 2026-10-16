import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, UPLOAD_TYPES } from "@/lib/uploads";

const CONTENT_TYPES = Object.fromEntries(Object.entries(UPLOAD_TYPES).map(([type, ext]) => [ext, type]));

export async function GET(_request: Request, { params }: RouteContext<"/uploads/[file]">) {
  const name = path.basename((await params).file); // evita rutas tipo ../
  const type = CONTENT_TYPES[path.extname(name).slice(1).toLowerCase()];
  if (!type) return new Response("No encontrado", { status: 404 });
  try {
    const data = await readFile(path.join(UPLOAD_DIR, name));
    return new Response(data, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
