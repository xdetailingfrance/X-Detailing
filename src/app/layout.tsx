import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { origineSite } from "@/lib/email";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Sans metadataBase, Next ne peut construire ni les URL canoniques ni les
  // images de partage : elles seraient relatives, donc inexploitables par
  // les moteurs et les messageries.
  metadataBase: new URL(origineSite()),
  title: "X Detailing OS",
  description: "Back-office X Detailing — réservation, affectation et pilotage du réseau.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}

