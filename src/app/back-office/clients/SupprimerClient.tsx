"use client";

// Suppression d'une fiche client. En deux temps : le premier clic arme, le
// second efface — il n'y a pas de retour en arrière, et la fiche emporte
// adresses, véhicules et rendez-vous non facturés.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SupprimerClient({
  clientId,
  nomComplet,
  nbRendezVous,
}: {
  clientId: string;
  nomComplet: string;
  nbRendezVous: number;
}) {
  const router = useRouter();
  const [arme, setArme] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer() {
    setEnCours(true);
    setErreur(null);
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    setEnCours(false);
    setArme(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.error ?? "Suppression impossible.");
      return;
    }
    router.refresh();
  }

  if (erreur) {
    return (
      <div className="text-xs text-[var(--warning)]">
        <p>{erreur}</p>
        <button onClick={() => setErreur(null)} className="underline">
          Fermer
        </button>
      </div>
    );
  }

  if (!arme) {
    return (
      <button
        onClick={() => setArme(true)}
        className="text-xs text-[var(--muted)] underline hover:text-[var(--danger)]"
      >
        Supprimer
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--muted)]">
        Effacer {nomComplet}
        {nbRendezVous > 0 && ` et ses ${nbRendezVous} rendez-vous`} ?
      </span>
      <div className="flex gap-2">
        <button onClick={supprimer} disabled={enCours} className="font-medium text-[var(--danger)] underline disabled:opacity-50">
          {enCours ? "Suppression…" : "Confirmer"}
        </button>
        <button onClick={() => setArme(false)} className="underline">
          Annuler
        </button>
      </div>
    </div>
  );
}
