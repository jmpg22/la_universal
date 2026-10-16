"use client";

import { useActionState } from "react";
import { changePassword } from "@/actions/auth";
import { FormMessage } from "@/components/admin/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="current" className="label">Contraseña actual</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="next" className="label">Nueva contraseña</label>
          <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <div>
          <label htmlFor="confirm" className="label">Repite la nueva</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
      </div>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-secondary">
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
