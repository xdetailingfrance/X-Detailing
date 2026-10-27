"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StatutToggle({
  operateurId,
  statut,
}: {
  operateurId: string;
  statut: "ACTIF" | "SUSPENDU";
}) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

    async function basculer() {
      setEnCours(true);
      const nouveauStatut = statut === "ACTIF" ? "SUSPENDU" : "ACTIF";
      await fetch(`/api/operateurs/${operateurId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      setEnCours(false);
      router.refresh();
    }

    return (
      <button
        onClick={basculer}
        disabled={enCours}
        className={`rounded-md px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
          statut === "ACTIF"
            ? "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--danger)]"
            : "bg-[var(--accent)] hover:bg-[var(--accent-2)]"
        }`}
      >
        {statut === "ACTIF" ? "Suspendre" : "Réactiver"}
      </button>
    );
}

