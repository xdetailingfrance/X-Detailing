import { Unbounded, Manrope } from "next/font/google";
import "./landing.css";

/**
 * Coque de la landing opérateur.
 *
 * Séparée du site client : elle s'adresse à des candidats venus d'une publicité, elle a
 * sa propre charte et son propre en-tête. Les mélanger obligerait chaque évolution de
 * l'une à passer par l'autre.
 */

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function LandingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`lp min-h-dvh ${unbounded.variable} ${manrope.variable}`}>{children}</div>
  );
}
