"use client";

import { useState } from "react";
import type { StatutDevis } from "@/lib/types";

const LIBELLE_STATUT: Record<StatutDevis, string> = {
  BROUILLON: "En préparation",
  ENVOYE: "En attente de votre réponse",
  CONSULTE: "En attente de votre réponse",
  ACCEPTE: "Accepté — acompte à régler",
  ACOMPTE_PAYE: "Acompte payé — rendez-vous en préparation",
  RDV_CREE: "Rendez-vous programmé",
  REFUSE: "Refusé",
};

export default function DevisActions({ token, statut }: { token: string; statut: StatutDevis }) {
  const [etatStatut, setEtatStatut] = useState(statut);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

   async function appeler(chemin: string) {
     setEnCours(true);
     setErreur(null);
     const res = await fetch(`/api/devis-public/${token}/${chemin}`, { method: "POST" });
     const data = await res.json().catch(() => ({}));
     setEnCours(false);
     if (!res.ok) {
       setErreur(data.error ?? "Action impossible.");
       return;
     }
     // Paiement : direction la page sécurisée de Stripe.
     if (data.paiement?.url) {
       window.location.href = data.paiement.url;
       return;
     }
     setEtatStatut(data.statut);
   }

   return (
     <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
       <p className="text-sm font-medium">{LIBELLE_STATUT[etatStatut]}</p>
       {erreur && <p className="text-sm text-[var(--warning)]">{erreur}</p>}

      {(etatStatut === "ENVOYE" || etatStatut === "CONSULTE") && (
        <button
          onClick={() => appeler("accepter")}
          disabled={enCours}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
        >
          Accepter le devis
        </button>
      )}

      {etatStatut === "ACCEPTE" && (
        <button
          onClick={() => appeler("payer-acompte")}
          disabled={enCours}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
        >
          Payer l&apos;acompte (paiement sécurisé)
        </button>
      )}

        {etatStatut === "ACOMPTE_PAYE" && (
          <p className="text-sm text-[var(--muted)]">
            Merci ! Votre acompte est enregistré, notre équipe va vous proposer un créneau.
          </p>
        )}

      {etatStatut === "RDV_CREE" && (
        <p className="text-sm text-[var(--muted)]">Votre rendez-vous est programmé, vous recevrez un lien de suivi.</p>
      )}
    </div>
  );
}

