import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["500", "700", "800"] });

export const metadata: Metadata = {
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
