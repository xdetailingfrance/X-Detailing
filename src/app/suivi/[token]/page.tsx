import { notFound } from "next/navigation";
import { rendezVousParToken } from "@/lib/workflow";
import { rendezVousAvecRelations } from "@/lib/queries";
import { formatParis } from "@/lib/heure";
import { LIBELLE_ANGLE_PHOTO, type PhotoPrestation } from "@/lib/types";
import SuiviTrajet from "@/components/SuiviTrajet";
import NoteClient from "./NoteClient";

export const dynamic = "force-dynamic";

// Page publique de suivi client (aucune authentification requise, RDV
// retrouvé par jeton non deviné — jamais par l'id interne). Contrairement
// au reste de l'application, le prix/l'acompte du client sont ici SES
// PROPRES informations de facturation, pas une donnée financière interne
// de l'entreprise : aucune règle de cloisonnement ne s'applique.
const LIBELLE_CLIENT: Record<string, string> = {
  EN_ATTENTE: "Votre rendez-vous est en attente de confirmation.",
  CONFIRME: "Votre rendez-vous est confirmé.",
  EN_ROUTE: "Votre opérateur est en route.",
  ARRIVE: "Votre opérateur est arrivé.",
  CONTROLE: "Contrôle du véhicule en cours.",
  PHOTOS_AVANT: "Photos avant prestation en cours.",
  LAVAGE: "Votre prestation est en cours.",
  PHOTOS_APRES: "Photos après prestation en cours.",
  PAIEMENT: "Prestation terminée — paiement en cours.",
  EN_COURS: "Votre prestation est en cours.",
  TERMINE: "Prestation terminée — merci !",
  ANNULE: "Ce rendez-vous a été annulé.",
};

export default async function SuiviPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rdvBrut = await rendezVousParToken(token);
  if (!rdvBrut) notFound();
  const rdv = (await rendezVousAvecRelations(rdvBrut.id))!;
  const resteAPayer = rdv.prixTotal - (rdv.acompteStatut === "PAYE" ? rdv.acompte : 0);

    return (
      <div className="min-h-screen bg-[var(--background)] flex justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-semibold">X Detailing — suivi de votre prestation</h1>
               <p className="text-[var(--muted)] text-sm mt-1">
                 {formatParis(rdv.dateHeure, { dateStyle: "long", timeStyle: "short" })}
               </p>
             </div>

             <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
               <p className="font-medium">{LIBELLE_CLIENT[rdv.statut] ?? rdv.statut}</p>
             </div>

             {rdv.statut === "EN_ROUTE" && (
               <SuiviTrajet
                 token={token}
                 destinationLabel={`${rdv.adresse.adresse}, ${rdv.adresse.ville}`}
               />
             )}

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 grid grid-cols-2 gap-3 text-sm">
          <Info titre="Véhicule" valeur={`${rdv.vehicule.marque ?? rdv.categorieVehicule} ${rdv.vehicule.modele?? ""}`} />
          <Info titre="Pack" valeur={rdv.pack.nom} />
          <Info
            titre="Options"
            valeur={rdv.options.length > 0 ? rdv.options.map((o) => o.option.nom).join(", ") : "Aucune"}
          />
          <Info titre="Prix total" valeur={`${rdv.prixTotal} €`} />
          <Info titre="Acompte versé" valeur={`${rdv.acompte} €`} />
          <Info titre="Reste à payer" valeur={`${resteAPayer.toFixed(2)} €`} />
        </div>

          <Galerie
            titre="Avant la prestation"
            etape="avant"
            photos={rdv.photosAvant}
            rdvId={rdv.id}
            token={token}
          />
          <Galerie
            titre="Après la prestation"
            etape="apres"
            photos={rdv.photosApres}
            rdvId={rdv.id}
            token={token}
          />

          {rdv.statut === "TERMINE" && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
              <p className="text-sm text-[var(--success)]">Facture {rdv.numeroFacture}</p>
              <NoteClient token={token} noteInitiale={rdv.noteClient} />
            </div>
          )}
        </div>
      </div>
    );
}

/**
 * Les photos du véhicule, telles que l'opérateur les a prises.
 *
 * Servies par une route qui revérifie le jeton contre CE rendez-vous : le
 * stockage est privé, et une photo de voiture devant un domicile ne se trouve
 * à aucune URL devinable.
 *
 * Le bloc disparaît tant qu'aucune photo n'est prise, plutôt que d'afficher
 * quatre cadres vides pendant la moitié de la prestation.
 */
function Galerie({
  titre,
  etape,
  photos,
  rdvId,
  token,
}: {
  titre: string;
  etape: "avant" | "apres";
  photos: PhotoPrestation[];
  rdvId: string;
  token: string;
}) {
  const prises = photos.filter((p) => p.prise && p.chemin);
  if (prises.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <p className="text-sm font-medium">{titre}</p>
      <div className="grid grid-cols-2 gap-2">
        {prises.map((photo) => (
          <figure key={photo.angle} className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- flux privé, pas d'optimisation possible */}
            <img
              src={`/api/photos/${rdvId}/${etape}/${photo.angle.toLowerCase()}?token=${encodeURIComponent(token)}`}
              alt={`${LIBELLE_ANGLE_PHOTO[photo.angle]} — ${titre.toLowerCase()}`}
              className="w-full rounded object-cover"
            />
            <figcaption className="text-xs text-[var(--muted)]">
              {LIBELLE_ANGLE_PHOTO[photo.angle]}
            </figcaption>
          </figure>
        ))}
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

