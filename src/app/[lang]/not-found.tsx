import Link from "next/link";
import { localePath } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { lang, t } = await getI18n();
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-6xl" aria-hidden>
        🧺
      </p>
      <h1 className="mt-4 text-2xl font-extrabold text-stone-900">{t.notFound.title}</h1>
      <Link href={localePath(lang, "/")} className="btn btn-primary mt-6">
        {t.notFound.back}
      </Link>
    </div>
  );
}
