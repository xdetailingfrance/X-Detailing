"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StatutDevis } from "@/lib/types";
import { formatParis } from "@/lib/heure";

const LIBELLE_STATUT: Record<StatutDevis, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  CONSULTE: "Consulté par le client",
  ACCEPTE: "Accepté",
  ACOMPTE_PAYE: "Acompte payé",
  RDV_CREE: "Rendez-vous créé",
  REFUSE: "Refusé",
};

type Historique = { horodatage: string; libelle: string };

export default function DevisDetailPanel({
  devisId,
  statut,
  nomClient,
  telephoneClient,
  emailClient,
  adresse,
  vehiculeDescription,
  pack,
  options,
  prixTotal,
  acompte,
  token,
  rendezVousId,
  historique,
}: {
  devisId: string;
  statut: StatutDevis;
  nomClient: string;
  telephoneClient: string;
  emailClient: string | null;
  adresse: string;
  vehiculeDescription: string;
  pack: string;
  options: string[];
  prixTotal: number;
  acompte: number;
  token: string;
  rendezVousId: string | null;
  historique: Historique[];
}) {
  const router = useRouter();
  const [etatStatut, setEtatStatut] = useState(statut);
  const [historiqueEtat, setHistoriqueEtat] = useState(historique);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dateHeure, setDateHeure] = useState("");
  const [envoi, setEnvoi] = useState<{ envoye: boolean; erreur?: string } | null>(null);

   async function envoyer() {
     setEnCours(true);
     setErreur(null);
     setEnvoi(null);
     const res = await fetch(`/api/devis/${devisId}/envoyer`, { method: "POST" });
     const data = await res.json().catch(() => ({}));
     setEnCours(false);
     if (!res.ok) {
       setErreur(data.error ?? "Action impossible.");
       return;
     }
     setEtatStatut(data.statut);
     setHistoriqueEtat(data.historique.map((h: { horodatage: string; libelle: string }) => h));
     setEnvoi(data.envoi ?? null);
   }

   async function creerRdv() {
     if (!dateHeure) {
       setErreur("Choisissez une date et une heure pour le rendez-vous.");
       return;
     }
     setEnCours(true);
     setErreur(null);
     const res = await fetch(`/api/devis/${devisId}/creer-rdv`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ dateHeure }),
     });
     const data = await res.json().catch(() => ({}));
     setEnCours(false);
     if (!res.ok) {
       setErreur(data.error ?? "Action impossible.");
       return;
     }
     router.push(`/back-office/rendez-vous/${data.rendezVousId}`);
   }

  const lienPublic = typeof window !== "undefined" ? `${window.location.origin}/devis/${token}` : `/devis/${token}`;

   return (
     <div className="flex flex-col gap-6">
       <div>
         <h1 className="text-xl md:text-2xl font-semibold">Devis — {nomClient}</h1>
         <p className="text-[var(--muted)] text-sm mt-1">{LIBELLE_STATUT[etatStatut]}</p>
       </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-2 gap-4 text-sm">
        <Info titre="Client" valeur={`${nomClient} · ${telephoneClient}`} />
        <Info titre="Adresse" valeur={adresse} />
        <Info titre="Véhicule" valeur={vehiculeDescription || "—"} />
        <Info titre="Pack" valeur={pack} />
        <Info titre="Options" valeur={options.length > 0 ? options.join(", ") : "Aucune"} />
        <Info titre="Prix total" valeur={`${prixTotal} €`} />
        <Info titre="Acompte" valeur={`${acompte} €`} />
        <Info titre="Lien à envoyer au client" valeur={lienPublic} />
      </div>

        {erreur && <p className="text-sm text-[var(--warning)]">{erreur}</p>}

        {envoi && (
          <div
            className={`rounded-md border p-3 text-sm ${
              envoi.envoye
                ? "border-[var(--success)] bg-[var(--success)]/10"
                : "border-[var(--warning)] bg-[var(--warning)]/10"
            }`}
          >
            {envoi.envoye ? (
              <p>E-mail envoyé à {emailClient}. Le client a reçu le devis et son lien.</p>
            ) : (
              <>
                <p className="font-medium text-[var(--warning)]">L&apos;e-mail n&apos;est pas parti.</p>
                <p className="mt-1 text-[var(--muted)]">Raison donnée : {envoi.erreur ?? "non précisée"}</p>
                <p className="mt-1">
                  Le client n&apos;a rien reçu. Transmettez-lui le lien ci-dessus, ou corrigez la
                  configuration d&apos;envoi puis relancez.
                </p>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {etatStatut === "BROUILLON" ? (
            <button
              onClick={envoyer}
              disabled={enCours || !emailClient}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
            >
              {enCours ? "Envoi…" : "Envoyer le devis par e-mail"}
            </button>
          ) : (
            <button
              onClick={envoyer}
              disabled={enCours || !emailClient}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {enCours ? "Envoi…" : "Renvoyer l'e-mail"}
            </button>
          )}
          {!emailClient && (
            <span className="text-sm text-[var(--muted)]">
              Aucune adresse e-mail sur ce devis : seul le lien peut être transmis.
            </span>
          )}
        </div>

        {(etatStatut === "ENVOYE" || etatStatut === "CONSULTE") && (
          <p className="text-sm text-[var(--muted)]">En attente de la réponse du client sur son lien de devis.</p>
        )}

      {etatStatut === "ACCEPTE" && (
        <p className="text-sm text-[var(--muted)]">Le client doit encore régler l&apos;acompte depuis son lien dedevis.</p>
      )}

      {etatStatut === "ACOMPTE_PAYE" && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          <h2 className="font-medium">Créer le rendez-vous</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Date et heure</span>
            <input
              type="datetime-local"
              value={dateHeure}
              onChange={(e) => setDateHeure(e.target.value)}
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={creerRdv}
            disabled={enCours}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
          >
            Créer le rendez-vous puis affecter un opérateur
          </button>
        </div>
      )}

      {etatStatut === "RDV_CREE" && rendezVousId && (
        <a href={`/back-office/rendez-vous/${rendezVousId}`} className="text-sm text-[var(--accent)] hover:underline self-start">
          Ouvrir le rendez-vous créé →
        </a>
      )}

        <div>
          <h2 className="text-sm font-medium mb-2">Historique</h2>
          <div className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            {historiqueEtat
              .slice()
              .reverse()
              .map((h, index) => (
                <p key={index}>
                  {formatParis(new Date(h.horodatage), { dateStyle: "short", timeStyle: "short" })} — {h.libelle}
                </p>
              ))}
          </div>
        </div>
      </div>
    );
}

function Info({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)] uppercase tracking-wide">{titre}</p>
      <p className="break-all">{valeur}</p>
    </div>
  );
}

