"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type Candidat = {
  operateurId: string;
  nomComplet: string;
  secteurNom: string | null;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  // Non persistés : présents seulement après un appel au moteur d'affectation
  // sur cette page. caJour est en plus absent pour un rôle autre que OWNER
  // (donnée financière stratégique — règle absolue n°16 du cahier des charges).
  nbPrestationsJour?: number;
  caJour?: number;
};

export default function AffectationPanel({
  rendezVousId,
  operateurActuelId,
  candidatsInitiaux,
  adresse,
}: {
  rendezVousId: string;
  operateurActuelId: string | null;
  candidatsInitiaux: Candidat[];
  /** Adresse d'intervention, corrigeable ici quand elle n'est pas reconnue. */
  adresse: { adresse: string; ville: string; codePostal: string | null; geocodee: boolean };
}) {
  const router = useRouter();
  const [candidats, setCandidats] = useState<Candidat[]>(candidatsInitiaux);
  const [recherche, setRecherche] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [correction, setCorrection] = useState(false);
  const [champs, setChamps] = useState({
    adresse: adresse.adresse,
    codePostal: adresse.codePostal ?? "",
    ville: adresse.ville,
  });

  async function corrigerAdresse() {
    setErreur(null);
    const res = await fetch(`/api/rendez-vous/${rendezVousId}/adresse`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(champs),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.geocodee === false) {
      setErreur(data.erreur ?? data.error ?? "Adresse toujours introuvable.");
      return;
    }
    setCorrection(false);
    router.refresh();
    await trouverMeilleurOperateur();
  }

    async function trouverMeilleurOperateur() {
      setRecherche(true);
      setErreur(null);
      const res = await fetch(`/api/rendez-vous/${rendezVousId}/affectation`, {
         method: "POST",
       });
       setRecherche(false);
       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         setErreur(data.error ?? "Aucun candidat trouvé.");
         setCandidats([]);
         return;
       }
       const data = await res.json();
       setCandidats(data.candidats);
       if (data.candidats.length === 0) {
         // La raison vient du serveur : lui seul sait si c'est une question
         // d'horaires, de trajet ou de tournée déjà pleine.
         setErreur(data.raison ?? "Aucun opérateur ne peut réaliser ce rendez-vous.");
       }
   }

   async function valider(operateurId: string) {
     setValidation(operateurId);
     await fetch(`/api/rendez-vous/${rendezVousId}`, {
       method: "PATCH",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ operateurId, statut: "CONFIRME" }),
     });
     setValidation(null);
     router.refresh();
   }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Affectation</h2>
        <button
          onClick={trouverMeilleurOperateur}
          disabled={recherche}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
        >
          {recherche ? "Analyse en cours…" : "TROUVER LE MEILLEUR OPÉRATEUR"}
        </button>
      </div>

         {erreur && (
           <div className="text-sm text-[var(--warning)]">
             <p>{erreur}</p>
             {!adresse.geocodee && !correction && (
               <button onClick={() => setCorrection(true)} className="mt-1 underline">
                 Corriger l&apos;adresse d&apos;intervention
               </button>
             )}
           </div>
         )}

         {(correction || !adresse.geocodee) && (
           <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 flex flex-col gap-2">
             <p className="text-xs text-[var(--muted)]">
               Adresse d&apos;intervention — elle doit être reconnue pour calculer les trajets. Le code postal lève
               les homonymies entre communes.
             </p>
             <div className="flex flex-wrap gap-2">
               <input
                 value={champs.adresse}
                 onChange={(e) => setChamps({ ...champs, adresse: e.target.value })}
                 placeholder="N° et rue"
                 aria-label="Rue"
                 className="min-w-[14rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
               />
               <input
                 value={champs.codePostal}
                 onChange={(e) => setChamps({ ...champs, codePostal: e.target.value })}
                 placeholder="33360"
                 inputMode="numeric"
                 aria-label="Code postal"
                 className="w-24 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
               />
               <input
                 value={champs.ville}
                 onChange={(e) => setChamps({ ...champs, ville: e.target.value })}
                 placeholder="Ville"
                 aria-label="Ville"
                 className="w-40 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
               />
               <button
                 onClick={corrigerAdresse}
                 disabled={!champs.ville.trim()}
                 className="rounded-md bg-[var(--accent)] px-3 py-1 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
               >
                 Corriger et relancer
               </button>
             </div>
           </div>
         )}

      {candidats.length > 0 && (
        <div className="flex flex-col gap-2">
          {candidats.map((c, index) => (
            <div
              key={c.operateurId}
              className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
            >
              <div className="text-sm">
                <p className="font-medium">
                  #{index + 1} {c.nomComplet}{" "}
                  {operateurActuelId === c.operateurId && (
                    <span className="text-[var(--success)] text-xs">(affecté)</span>
                  )}
                </p>
                <p className="text-[var(--muted)] text-xs">
                  Score {c.score}/100 · {c.distanceKm} km · ETA {c.etaMinutes} min
                  {c.nbPrestationsJour != null ? ` · ${c.nbPrestationsJour} prestation(s) aujourd'hui` : ""}
                  {c.caJour != null ? ` · CA jour ${c.caJour} €` : ""}
                  {c.secteurNom ? ` · ${c.secteurNom}` : ""}
                </p>
              </div>
              <button
                onClick={() => valider(c.operateurId)}
                disabled={validation !== null}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
              >
                {validation === c.operateurId ? "Validation…" : "Valider"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

