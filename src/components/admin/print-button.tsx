"use client";

export function PrintButton({ children = "🖨️ Imprimir" }: { children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-secondary print:hidden">
      {children}
    </button>
  );
}
