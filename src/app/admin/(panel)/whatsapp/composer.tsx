"use client";

import { useActionState } from "react";
import { type ReplyState, type SimulateState, sendStaffReply, simulateCustomerMessage } from "@/actions/admin/whatsapp";

/** Caja para contestar como tienda. */
export function ReplyBox({ conversationId, botPaused }: { conversationId: number; botPaused: boolean }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(sendStaffReply.bind(null, conversationId), undefined);
  return (
    <form action={action} key={state?.sent} className="space-y-2">
      <textarea name="text" rows={2} required placeholder="Escribe una respuesta como tienda…" className="input" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-stone-500">
          {botPaused ? "El bot está en pausa en este chat." : "Al contestar tú, el bot se pausa en este chat."}
        </p>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {state?.error && <p className="text-sm font-semibold text-red-600">No se pudo enviar: {state.error}</p>}
    </form>
  );
}

/** Caja para escribir como si fueras el cliente (simulador). */
export function SimulatorBox({ conversationId }: { conversationId?: number }) {
  const [state, action, pending] = useActionState<SimulateState, FormData>(simulateCustomerMessage, undefined);
  return (
    <form action={action} className="space-y-2">
      {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
      <textarea
        name="text"
        rows={2}
        required
        placeholder="Escribe como cliente, p. ej. “Hola, me mandas 2 cocas de 600 y un kilo de huevo?”"
        className="input"
      />
      <div className="flex items-center justify-end gap-2">
        {pending && <span className="text-sm text-stone-500">El bot está pensando…</span>}
        <button type="submit" disabled={pending} className="btn btn-primary">
          Enviar como cliente
        </button>
      </div>
      {state?.error && <p className="text-sm font-semibold text-red-600">{state.error}</p>}
    </form>
  );
}
