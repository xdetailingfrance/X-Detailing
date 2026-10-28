"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnglePhoto, ModePaiement, PhotoPrestation, StatutRendezVous } from "@/lib/types";
import PartagePosition from "@/components/PartagePosition";
import PhotoTiles from "@/components/PhotoTiles";
import SignaturePad from "@/components/SignaturePad";
import { dureeLisible, formatParis } from "@/lib/heure";

type Historique = { horodatage: string; libelle: string };

type EtatWorkflow = {
  statut: StatutRendezVous;
  routeDemarreeAt: string | null;
  signatureControleDataUrl: string | null;
  photosAvant: PhotoPrestation[];
  photosApres: PhotoPrestation[];
  signatureFinDataUrl: string | null;
  modePaiement: ModePaiement | null;
  lienPaiementEnvoyeAt: string | null;
  numeroFacture: string | null;
  historique: Historique[];
};

const LIBELLE_STATUT: Record<StatutRendezVous, string> = {
  EN_ATTENTE: "En attente de confirmation",
  CONFIRME: "Confirmé — prêt à démarrer",
  EN_ROUTE: "En route",
  ARRIVE: "Arrivé",
  CONTROLE: "Contrôle & signature de début",
  PHOTOS_AVANT: "Photos avant",
  LAVAGE: "Prestation en cours",
  PHOTOS_APRES: "Photos après",
  PAIEMENT: "Paiement",
  EN_COURS: "En cours",
  TERMINE: "Clôturé",
  ANNULE: "Annulé",
};

export default function WorkflowPanel({
  rendezVousId,
  statut,
  client,
  adresse,
  vehicule,
  pack,
  options,
  dureeMinutes,
  resteAPayer,
  dateHeure,
  routeDemarreeAt,
  signatureControleDataUrl,
  photosAvant,
  photosApres,
  signatureFinDataUrl,
  modePaiement,
  lienPaiementEnvoyeAt,
  numeroFacture,
  historique,
  suiviToken,
}: {
  rendezVousId: string;
  statut: StatutRendezVous;
  client: string;
  adresse: string;
  vehicule: string;
  pack: string;
  options: string[];
  dureeMinutes: number;
  resteAPayer: number;
  dateHeure: string;
  routeDemarreeAt: string | null;
  signatureControleDataUrl: string | null;
  photosAvant: PhotoPrestation[];
  photosApres: PhotoPrestation[];
  signatureFinDataUrl: string | null;
  modePaiement: ModePaiement | null;
  lienPaiementEnvoyeAt: string | null;
  numeroFacture: string | null;
  historique: Historique[];
  suiviToken: string;
}) {
  const router = useRouter();
  const [etat, setEtat] = useState<EtatWorkflow>({
    statut,
    routeDemarreeAt,
    signatureControleDataUrl,
    photosAvant,
    photosApres,
    signatureFinDataUrl,
    modePaiement,
    lienPaiementEnvoyeAt,
    numeroFacture,
    historique,
  });
  const [especesVerifiees, setEspecesVerifiees] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

   async function envoyer(action: Record<string, unknown>) {
     setEnCours(true);
     setErreur(null);
     const res = await fetch(`/api/operateur/rendez-vous/${rendezVousId}/workflow`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(action),
     });
     const data = await res.json().catch(() => ({}));
     setEnCours(false);
     if (!res.ok) {
       setErreur(data.error ?? "Action impossible.");
       return;
     }
     setEtat({
       statut: data.statut,
       routeDemarreeAt: data.routeDemarreeAt,
       signatureControleDataUrl: data.signatureControleDataUrl,
       photosAvant: data.photosAvant,
       photosApres: data.photosApres,
       signatureFinDataUrl: data.signatureFinDataUrl,
       modePaiement: data.modePaiement,
       lienPaiementEnvoyeAt: data.lienPaiementEnvoyeAt,
       numeroFacture: data.numeroFacture,
       historique: data.historique,
     });
     router.refresh();
   }

  /**
   * Envoi d'une photo réelle. L'image part en multipart vers une route dédiée
   * qui la dépose d'abord dans le stockage privé, puis seulement ensuite coche
   * l'angle : dans l'autre ordre, une coupure réseau validerait une étape sans
   * photo, et le workflow autoriserait la suite sur une preuve absente.
   *
   * Rend le message d'erreur plutôt que de le poser dans l'état global : il
   * s'affiche sous la tuile concernée, là où l'opérateur regarde.
   */
  async function envoyerPhoto(etape: "avant" | "apres", angle: AnglePhoto, fichier: File) {
    const formulaire = new FormData();
    formulaire.append("etape", etape);
    formulaire.append("angle", angle);
    formulaire.append("fichier", fichier);

    const res = await fetch(`/api/operateur/rendez-vous/${rendezVousId}/photo`, {
      method: "POST",
      body: formulaire,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Envoi impossible.";

    setEtat((precedent) => ({
      ...precedent,
      statut: data.statut,
      photosAvant: data.photosAvant,
      photosApres: data.photosApres,
      historique: data.historique,
    }));
    router.refresh();
    return null;
  }

   const toutesPhotosAvant = etat.photosAvant.every((p) => p.prise);
   const toutesPhotosApres = etat.photosApres.every((p) => p.prise);

   return (
     <div className="flex flex-col gap-6">
       <div>
         <h1 className="text-2xl font-semibold">{client}</h1>
         <p className="text-[var(--muted)] text-sm mt-1">
           {formatParis(new Date(dateHeure), { dateStyle: "long", timeStyle: "short" })} ·{" "}
           {LIBELLE_STATUT[etat.statut]}
         </p>
       </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-2 gap-4 text-sm">
        <Info titre="Adresse" valeur={adresse} />
        <Info titre="Véhicule" valeur={vehicule} />
        <Info titre="Pack" valeur={`${pack} (${dureeLisible(dureeMinutes)})`} />
        <Info titre="Options" valeur={options.length > 0 ? options.join(", ") : "Aucune"} />
        <Info titre="Reste à payer" valeur={`${resteAPayer.toFixed(2)} €`} />
        <Info
          titre="Lien de suivi client"
          valeur={`/suivi/${suiviToken}`}
        />
      </div>

      {erreur && (
        <p className="text-sm text-[var(--warning)] rounded-md border border-[var(--warning)] bg-[var(--surface)]px-3 py-2">
          {erreur}
        </p>
      )}

        {etat.statut === "ANNULE" && (
          <p className="text-sm text-[var(--muted)]">Ce rendez-vous a été annulé.</p>
        )}

        {etat.statut === "EN_ATTENTE" && (
          <p className="text-sm text-[var(--muted)]">En attente de confirmation par la direction.</p>
        )}

      {etat.statut === "CONFIRME" && (
        <Etape titre="Démarrer la route">
          <button
            onClick={() => envoyer({ type: "DEMARRER_ROUTE" })}
            disabled={enCours}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
          >
            Démarrer la route
          </button>
        </Etape>
      )}

      {etat.statut === "EN_ROUTE" && etat.routeDemarreeAt && (
        <Etape titre="En route vers le client">
          <PartagePosition rendezVousId={rendezVousId} />
          <button
            onClick={() => envoyer({ type: "CONFIRMER_ARRIVEE" })}
            disabled={enCours}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
          >
            Je suis arrivé sur place
          </button>
        </Etape>
      )}

        {etat.statut === "CONTROLE" && (
          <Etape titre="Contrôle véhicule & signature client">
            <p className="text-sm text-[var(--muted)]">
              Vérifiez le véhicule, la catégorie et le prix avec le client avant de commencer.
            </p>
            {!etat.signatureControleDataUrl ? (
              <SignaturePad
              label="Signature du client (accord contrôle)"
              onValider={(dataUrl) => envoyer({ type: "SIGNATURE_CONTROLE", dataUrl })}
              disabled={enCours}
            />
          ) : (
            <>
              <p className="text-sm text-[var(--success)]">Signature enregistrée ✅ </p>
              <button
                onClick={() => envoyer({ type: "PASSER_PHOTOS_AVANT" })}
                disabled={enCours}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)]transition disabled:opacity-50 self-start"
              >
                Continuer vers les photos avant
              </button>
            </>
          )}
        </Etape>
      )}

      {etat.statut === "PHOTOS_AVANT" && (
        <Etape titre="Photos avant prestation (4 angles obligatoires)">
          <PhotoTiles
            photos={etat.photosAvant}
            rdvId={rendezVousId}
            etape="avant"
            onPhoto={(angle, fichier) => envoyerPhoto("avant", angle, fichier)}
            disabled={enCours}
          />
          {toutesPhotosAvant && (
            <button
              onClick={() => envoyer({ type: "PASSER_LAVAGE" })}
              disabled={enCours}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
            >
              Démarrer la prestation
            </button>
          )}
        </Etape>
      )}

      {etat.statut === "LAVAGE" && (
        <Etape titre="Prestation en cours">
          <p className="text-sm text-[var(--muted)]">Le véhicule est en cours de traitement.</p>
          <button
            onClick={() => envoyer({ type: "TERMINER_LAVAGE" })}
            disabled={enCours}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
          >
            Terminer la prestation
          </button>
        </Etape>
      )}

      {etat.statut === "PHOTOS_APRES" && (
        <Etape titre="Photos après prestation (4 angles obligatoires)">
          <PhotoTiles
            photos={etat.photosApres}
            rdvId={rendezVousId}
            etape="apres"
            onPhoto={(angle, fichier) => envoyerPhoto("apres", angle, fichier)}
            disabled={enCours}
          />
          {toutesPhotosApres && !etat.signatureFinDataUrl && (
            <SignaturePad
              label="Signature du client (fin de prestation)"
              onValider={(dataUrl) => envoyer({ type: "SIGNATURE_FIN", dataUrl })}
              disabled={enCours}
            />
          )}
          {toutesPhotosApres && etat.signatureFinDataUrl && (
            <>
              <p className="text-sm text-[var(--success)]">Signature enregistrée ✅</p>
              <button
                onClick={() => envoyer({ type: "PASSER_PAIEMENT" })}
                disabled={enCours}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)]transition disabled:opacity-50 self-start"
              >
                Continuer vers le paiement
              </button>
            </>
          )}
        </Etape>
      )}

        {etat.statut === "PAIEMENT" && (
          <Etape titre={`Paiement — ${resteAPayer.toFixed(2)} € à encaisser`}>
            {!etat.modePaiement && (
            <div className="flex gap-2">
              <button
                onClick={() => envoyer({ type: "CHOISIR_MODE_PAIEMENT", mode: "CARTE" })}
                disabled={enCours}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]disabled:opacity-50"
              >
                Carte (lien à distance)
              </button>
              <button
                onClick={() => envoyer({ type: "CHOISIR_MODE_PAIEMENT", mode: "ESPECES" })}
                disabled={enCours}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]disabled:opacity-50"
              >
                Espèces
              </button>
            </div>
          )}

          {etat.modePaiement === "CARTE" && !etat.lienPaiementEnvoyeAt && (
            <button
              onClick={() => envoyer({ type: "ENVOYER_LIEN_PAIEMENT" })}
              disabled={enCours}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50 self-start"
            >
              Envoyer le lien de paiement (SMS simulé)
            </button>
          )}

          {etat.modePaiement === "CARTE" && etat.lienPaiementEnvoyeAt && (
            <>
              <p className="text-sm text-[var(--success)]">Lien de paiement envoyé ✅</p>
              <button
                onClick={() => envoyer({ type: "CONFIRMER_PAIEMENT" })}
                disabled={enCours}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)]transition disabled:opacity-50 self-start"
              >
                Confirmer le paiement reçu
              </button>
            </>
          )}

          {etat.modePaiement === "ESPECES" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={especesVerifiees}
                  onChange={(e) => setEspecesVerifiees(e.target.checked)}
                />
                Espèces comptées et vérifiées ({resteAPayer.toFixed(2)} €)
              </label>
              <button
                onClick={() => envoyer({ type: "CONFIRMER_PAIEMENT" })}
                disabled={enCours || !especesVerifiees}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)]transition disabled:opacity-50 self-start"
              >
                Confirmer le paiement
              </button>
            </>
          )}
        </Etape>
      )}

        {etat.statut === "TERMINE" && (
          <Etape titre="Dossier clôturé">
            <p className="text-sm text-[var(--success)]">
              Paiement confirmé — facture {etat.numeroFacture}.
            </p>
          </Etape>
        )}

        <div>
          <h2 className="text-sm font-medium mb-2">Historique</h2>
          <div className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            {etat.historique
              .slice()
              .reverse()
              .map((h, index) => (
                <p key={index}>
                  {formatParis(new Date(h.horodatage), { hour: "2-digit", minute: "2-digit" })} — {h.libelle}
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
      <p>{valeur}</p>
    </div>
  );
}

function Etape({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <h2 className="font-medium">{titre}</h2>
      {children}
    </div>
  );
}

