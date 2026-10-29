import { notFound } from "next/navigation";
import { devisAvecRelations } from "@/lib/queries";
import DevisDetailPanel from "./DevisDetailPanel";

export const dynamic = "force-dynamic";

export default async function DevisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const devis = await devisAvecRelations(id);
  if (!devis) notFound();

  return (
    <div className="max-w-2xl">
      <DevisDetailPanel
        devisId={devis.id}
        statut={devis.statut}
        nomClient={devis.nomClient}
        telephoneClient={devis.telephoneClient}
        emailClient={devis.emailClient}
        adresse={`${devis.adresse}, ${devis.ville}`}
        vehiculeDescription={devis.vehiculeDescription}
        pack={devis.pack.nom}
        options={devis.options.map((o) => o.nom)}
        prixTotal={devis.prixTotal}
        acompte={devis.acompte}
        token={devis.token}
        rendezVousId={devis.rendezVousId}
        historique={devis.historique.map((h) => ({ horodatage: h.horodatage.toISOString(), libelle: h.libelle}))}
      />
    </div>
  );
}

