"use client";

import { useFormStatus } from "react-dom";

/** Botón de envío que pide confirmación antes de mandar el formulario. */
export function ConfirmButton({
  message,
  className = "btn btn-danger",
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function SubmitButton({ className = "btn btn-primary", children, pendingText }: { className?: string; children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
