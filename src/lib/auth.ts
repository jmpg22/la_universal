import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/session-token";

export async function startSession(userId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Devuelve el administrador con sesión activa o redirige al login.
 * Toda página y acción del panel debe llamarla: proxy.ts solo hace una revisión optimista.
 */
export async function requireAdmin() {
  await connection(); // la verificación del token depende de la hora actual: siempre en tiempo de solicitud
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const user = session
    ? await db.adminUser.findUnique({ where: { id: session.uid }, select: { id: true, name: true, email: true } })
    : null;
  if (!user) redirect("/admin/login");
  return user;
}
