import { Fredoka, Nunito } from "next/font/google";

export const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

/** Títulos de la tienda: redondeada y amigable. */
export const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
