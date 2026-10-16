import type { Metadata, Viewport } from "next";
import { nunito } from "../fonts";
import "../globals.css";

// Layout raíz del panel de administración (siempre en español).
export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel La Universal" },
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#1a7c4f",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="es-MX" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
