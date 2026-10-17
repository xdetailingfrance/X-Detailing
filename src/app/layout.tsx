import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BUSINESS, siteUrl } from "@/lib/business";

/**
 * Police : SF Pro Display.
 *
 * Apple ne licencie pas SF Pro pour le web — elle ne peut pas être servie depuis
 * le site. Elle est donc appelée par la pile système (voir `globals.css`) : tout
 * Mac, iPhone et iPad l'affiche nativement. Inter, dessinée sur les mêmes
 * proportions, prend le relais ailleurs. `next/font` l'auto-héberge : aucun appel
 * à Google depuis le navigateur du visiteur.
 */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const TITLE = `Lavage et detailing automobile à ${BUSINESS.city} · ${BUSINESS.name}`;
const DESCRIPTION =
  "Nettoyage intérieur ou intérieur + extérieur de votre voiture, chez vous ou au " +
  "travail, à Bordeaux et alentours. Tarif annoncé à l'avance, dès 129 €. " +
  "Réservation en ligne, trois créneaux par jour.";

export const metadata: Metadata = {
  /**
   * Sans base explicite, Next émet des canoniques relatives, qui se résolvent
   * contre l'hôte qui sert la page : chaque adresse `.vercel.app` se déclarerait
   * alors canonique d'elle-même, en concurrence avec le domaine.
   */
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: BUSINESS.name,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      { url: "/marque/logo-x-detailing.jpeg", width: 1254, height: 1254, alt: BUSINESS.name },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/marque/logo-x-detailing.jpeg"],
  },
  icons: {
    icon: [{ url: "/marque/icone-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/marque/icone-180.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
