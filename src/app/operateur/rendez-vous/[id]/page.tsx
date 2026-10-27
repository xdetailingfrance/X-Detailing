import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { rendezVousAvecRelations } from "@/lib/queries";
import { authDesactivee } from "@/lib/auth";
import WorkflowPanel from "./WorkflowPanel";

export const dynamic = "force-dynamic";

// Détail d'un RDV côté opérateur : pilote le workflow verrouillé de bout en
// bout (arrivée → contrôle signé → photos avant → prestation → photos
// après → signature de fin → paiement → clôture). Jamais de prixTotal ni
// d'acompte affichés ici — seulement le reste à payer, comme partout
// ailleurs côté opérateur (cloisonnement financier, règle absolue n°4).
export default async function RendezVousOperateurPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const destinationSecours = authDesactivee() ? "/demo" : "/login";
  if (!session?.operateurId) redirect(destinationSecours);

   const { id } = await params;
   const rdv = await rendezVousAvecRelations(id);
   if (!rdv) notFound();
   if (rdv.operateurId !== session.operateurId) {
     redirect("/operateur");
   }

   // Seul un acompte validé par Stripe est déduit du montant à encaisser.
   const resteAPayer = rdv.prixTotal - (rdv.acompteStatut === "PAYE" ? rdv.acompte : 0);

   return (
     <div className="max-w-2xl">
       <WorkflowPanel
         rendezVousId={rdv.id}
         statut={rdv.statut}
         client={`${rdv.client.prenom} ${rdv.client.nom}`}
          adresse={`${rdv.adresse.adresse}, ${rdv.adresse.ville}`}
          vehicule={`${rdv.vehicule.marque ?? rdv.categorieVehicule} ${rdv.vehicule.modele ?? ""}`.trim()}
          pack={rdv.pack.nom}
          options={rdv.options.map((o) => (o.quantite > 1 ? `${o.option.nom} × ${o.quantite}` : o.option.nom))}
          dureeMinutes={rdv.dureeMinutes}
          resteAPayer={resteAPayer}
          dateHeure={rdv.dateHeure.toISOString()}
          routeDemarreeAt={rdv.routeDemarreeAt ? rdv.routeDemarreeAt.toISOString() : null}
          signatureControleDataUrl={rdv.signatureControleDataUrl}
          photosAvant={rdv.photosAvant}
          photosApres={rdv.photosApres}
          signatureFinDataUrl={rdv.signatureFinDataUrl}
          modePaiement={rdv.modePaiement}
          lienPaiementEnvoyeAt={rdv.lienPaiementEnvoyeAt ? rdv.lienPaiementEnvoyeAt.toISOString() : null}
          numeroFacture={rdv.numeroFacture}
          historique={rdv.historique.map((h) => ({ horodatage: h.horodatage.toISOString(), libelle: h.libelle }))}
          suiviToken={rdv.suiviToken}
        />
      </div>
    );
}

