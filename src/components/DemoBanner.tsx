import Link from "next/link";
import { authDesactivee } from "@/lib/auth";

// S'affiche tant que l'authentification est désactivée (comportement par
// défaut en phase de développement — voir src/lib/auth.ts). Positionner
// DISABLE_AUTH=false pour repasser en authentification réelle et faire
// disparaître ce bandeau.
export default function DemoBanner() {
  if (!authDesactivee()) return null;
  return (
    <div className="bg-[var(--warning)] text-black text-xs font-medium text-center py-1.5 px-4 flex items-center justify-center gap-3">
      <span>Mode développement — authentification désactivée.</span>
      <Link href="/demo" className="underline">
        Changer de profil démo
      </Link>
    </div>
  );
}

