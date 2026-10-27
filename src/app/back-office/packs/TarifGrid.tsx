"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  ["CITADINE", "Citadine"],
  ["BERLINE", "Berline"],
  ["SUV", "SUV"],
  ["MONOSPACE", "Monospace"],
  ["UTILITAIRE", "Utilitaire"],
] as const;

export default function TarifGrid({
  packId,
  tarifs,
}: {
  packId: string;
  tarifs: { categorie: string; prix: string }[];
}) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map(([c]) => [c, tarifs.find((t) => t.categorie === c)?.prix ?? ""]))
  );
  const [enCours, setEnCours] = useState<string | null>(null);

    async function enregistrer(categorie: string) {
      const prix = valeurs[categorie];
      if (prix === "") return;
      setEnCours(categorie);
      await fetch(`/api/packs/${packId}/tarifs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorie, prix: Number(prix) }),
      });
      setEnCours(null);
      router.refresh();
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {CATEGORIES.map(([valeur, libelle]) => (
          <label key={valeur} className="flex flex-col gap-1 text-xs">
            <span className="text-[var(--muted)]">{libelle}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                placeholder="à paramétrer"
                value={valeurs[valeur]}
                onChange={(e) => setValeurs((v) => ({ ...v, [valeur]: e.target.value }))}
                onBlur={() => enregistrer(valeur)}
                className="w-full rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1 text-sm"
              />
              <span className="text-[var(--muted)]">€</span>
            </div>
            {enCours === valeur && <span className="text-[var(--muted)]">Enregistrement…</span>}
          </label>
        ))}
      </div>
    );
}

