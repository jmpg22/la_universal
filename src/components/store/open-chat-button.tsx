"use client";

import { useOrderChat } from "./order-chat-context";

/** Cualquier botón que abre el chat de pedidos (encabezado, portada, búsqueda sin resultados…). */
export function OpenChatButton({
  children,
  className = "",
  variant = "primary",
  prefill,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "sun" | "ghost";
  prefill?: string;
}) {
  const { openChat } = useOrderChat();
  const styles = {
    primary: "btn btn-primary rounded-full px-5",
    sun: "btn btn-sun rounded-full px-6 py-3.5 text-base",
    ghost: "btn rounded-full bg-white/15 px-6 py-3.5 text-base text-white ring-1 ring-white/40 hover:bg-white/25",
  }[variant];
  return (
    <button type="button" onClick={() => openChat({ hint: prefill })} className={`${styles} ${className}`}>
      {children}
    </button>
  );
}
