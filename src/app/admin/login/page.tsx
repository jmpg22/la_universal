import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar al panel", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-brand-900 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-3xl" aria-hidden>
            🛒
          </span>
          <h1 className="mt-3 text-2xl font-extrabold">Panel de La Universal</h1>
          <p className="text-sm text-brand-200">Entra para administrar la tienda</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-brand-200 hover:text-white">
            ← Volver a la tienda
          </Link>
        </p>
      </div>
    </main>
  );
}
