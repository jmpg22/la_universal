import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LANG_COOKIE, isLocale, stripLocale } from "@/lib/i18n/config";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGuard(request);
  return storeLocale(request);
}

// Panel: revisión optimista; la autorización real ocurre en requireAdmin() en cada página y acción.
async function adminGuard(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (request.nextUrl.pathname === "/admin/login") {
    return session ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }
  return session ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login", request.url));
}

/** Idioma preferido del navegador entre los que tenemos (solo se usa si el visitante no ha elegido). */
function browserLocale(header: string | null) {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang;
}

// Tienda: el español vive sin prefijo y se reescribe internamente a /es; el inglés vive en /en.
function storeLocale(request: NextRequest) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // /es/... no es una URL pública: se manda a la versión sin prefijo.
  if (pathname === `/${DEFAULT_LOCALE}` || pathname.startsWith(`/${DEFAULT_LOCALE}/`)) {
    url.pathname = pathname.slice(DEFAULT_LOCALE.length + 1) || "/";
    return NextResponse.redirect(url);
  }
  if (stripLocale(pathname) !== pathname) return NextResponse.next(); // ya trae /en

  // Ruta en español. Si el visitante eligió inglés (o su navegador lo prefiere y no ha elegido), se le manda a /en.
  const chosen = request.cookies.get(LANG_COOKIE)?.value;
  const preferred = isLocale(chosen) ? chosen : browserLocale(request.headers.get("accept-language"));
  const isRead = request.method === "GET" || request.method === "HEAD";
  if (isRead && preferred && preferred !== DEFAULT_LOCALE) {
    url.pathname = pathname === "/" ? `/${preferred}` : `/${preferred}${pathname}`;
    return NextResponse.redirect(url);
  }

  url.pathname = pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Todo menos archivos internos, API, fotos subidas y archivos con extensión (favicon.ico, etc.).
  matcher: ["/((?!_next/|api/|uploads/|.*\\..*).*)"],
};
