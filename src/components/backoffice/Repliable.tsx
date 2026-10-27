"use client";

import { useState, type ReactNode } from "react";

// Sur téléphone, le contenu (ex. les filtres) se replie derrière un bouton ;
// sur ordinateur, il est toujours visible.
export default function Repliable({ libelle, children }: { libelle: string; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="bo-panneau flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm md:hidden"
        >
          <span>{libelle}</span>
          <span className="text-[var(--muted)]">{ouvert ? "Masquer" : "Modifier"}</span>
        </button>
        <div className={`${ouvert ? "mt-2 block" : "hidden"} md:mt-0 md:block`}>{children}</div>
      </div>
    );
}

