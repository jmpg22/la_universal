"use client";

import { useActionState } from "react";
import { translateMissingAction } from "@/actions/admin/translate";
import { FormMessage } from "@/components/admin/ui";

export function TranslateButton({ missing }: { missing: number }) {
  const [state, action, pending] = useActionState(translateMissingAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Traduciendo… (puede tardar un minuto)" : `✨ Traducir con IA lo que falta${missing ? ` (${missing})` : ""}`}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
