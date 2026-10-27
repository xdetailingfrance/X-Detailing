"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bouton flottant présent sur toutes les pages du back-office sauf
// l'accueil (où Lola est déjà) : un appui ramène à l'accueil, Lola écoute.
export default function LolaRaccourci() {
  const pathname = usePathname();
  if (pathname === "/back-office") return null;
  return (
    <Link
      href="/back-office#lola"
      aria-label="Parler à Lola"
      className="lola-raccourci fixed z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#c4a5ff] via-[var(--accent)] to-[var(--accent-2)] text-[10px] font-semibold uppercase tracking-[0.2em]text-white shadow-[0_0_28px_-4px_var(--accent)]"
      style={{ right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))"}}
    >
      Lola
    </Link>
  );
}

