import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/business";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["500", "700", "800"] });

export const metadata: Metadata = {
  /**
   * Sans base explicite, Next.js émet des canoniques relatives (`href="/"`), qui se
   * résolvent contre l'hôte qui sert la page. Le même site répondant sur son domaine
   * et sur plusieurs adresses `.vercel.app`, chaque copie se déclarait alors canonique
   * d'elle-même : quatre sites identiques en concurrence au lieu d'un seul consolidé.
   */
  metadataBase: new URL(siteUrl()),
  title: { default: "X Detailing", template: "%s" },
  description:
    "Lavage automobile mobile, intérieur et extérieur, à domicile et en entreprise.",
  icons: {
    icon: [{ url: "/marque/icone-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/marque/icone-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
