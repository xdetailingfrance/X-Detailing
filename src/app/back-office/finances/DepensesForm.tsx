"use client";

import { useState } from "react";

// Dépenses fixes + coût publicitaire du mois, éditables par le OWNER — la
// marge nette est recalculée en direct côté client (commission réseau déjà
// connue côté serveur, jamais recalculée à partir d'une valeur du client).
export default function DepensesForm({
  depensesInitiales,
  publiciteInitiale,
  commissionMois,
}: {
  depensesInitiales: number;
  publiciteInitiale: number;
  commissionMois: number;
}) {
  const [depenses, setDepenses] = useState(depensesInitiales);
  const [publicite, setPublicite] = useState(publiciteInitiale);
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

   const margeNette = commissionMois - depenses - publicite;

   async function enregistrer() {
     setEnregistrement(true);
     setEnregistre(false);
     const res = await fetch("/api/finances/depenses", {
       method: "PATCH",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ depenses, publicite }),
     });
     setEnregistrement(false);
     if (!res.ok) {
       const data = await res.json().catch(() => ({}));
       setErreur(data.error ?? "Enregistrement impossible.");
       return;
     }
     setErreur(null);
     setEnregistre(true);
   }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4 max-w-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Dépenses fixes (€)</span>
          <input
            type="number"
            min={0}
            value={depenses}
            onChange={(e) => setDepenses(Number(e.target.value))}
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Publicité / leads (€)</span>
          <input
            type="number"
            min={0}
            value={publicite}
            onChange={(e) => setPublicite(Number(e.target.value))}
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
      </div>

        <div className="text-sm">
          <p>
            Commission réseau (18 %, mois) : <strong>{commissionMois.toFixed(0)} €</strong>
          </p>
          <p className={margeNette >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
            Marge nette estimée : <strong>{margeNette.toFixed(0)} €</strong>
          </p>
        </div>

      <div className="flex items-center gap-2">
        <button
          onClick={enregistrer}
          disabled={enregistrement}
          className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
        >
            {enregistrement ? "Enregistrement…" : "Enregistrer"}
          </button>
          {enregistre && <span className="text-xs text-[var(--success)]">Enregistré✅</span>}
          {erreur && <span className="text-xs text-[var(--danger)]">{erreur}</span>}
        </div>
      </div>
    );
}

