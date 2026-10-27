import { notFound } from "next/navigation";
import LogoMarque from "@/components/accueil/LogoMarque";
import { devisParToken, marquerDevisConsulte } from "@/lib/devis";
import { devisAvecRelations } from "@/lib/queries";
import { verifierRetourPaiementDevis } from "@/lib/paiement";
import { formatParis } from "@/lib/heure";
import DevisActions from "./DevisActions";

export const dynamic = "force-dynamic";

// Document de devis public, consultable sans authentification (jeton non
// deviné) — reproduit le générateur de devis avec logo/tarifs demandé,
// converti en vraie page plutôt qu'un PDF envoyé par e-mail.
export default async function DevisPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paiement?: string; session_id?: string }>;
}) {
  const { token } = await params;
  const retour = await searchParams;
  const devisBrut = await devisParToken(token);
  if (!devisBrut) notFound();

  // La première consultation du client fait passer le devis "envoyé" à
  // "consulté" — comme un accusé de lecture.
  await marquerDevisConsulte(devisBrut);
  // Retour de Stripe : l'acompte n'est validé qu'après vérification.
  if (retour.paiement === "reussi" && retour.session_id) await verifierRetourPaiementDevis(devisBrut.id, retour.session_id);
  const devis = (await devisAvecRelations(devisBrut.id))!;

   return (
     <div className="min-h-screen bg-[var(--background)] flex justify-center p-6">
       <div className="w-full max-w-lg flex flex-col gap-6">
         <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-col gap-4">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                  <LogoMarque className="h-10 w-10" />
                  <span className="font-semibold tracking-wide">X Detailing OS</span>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  Devis du {formatParis(devis.createdAt, { dateStyle: "short" })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm border-t border-b border-[var(--border)] py-4">
                <Info titre="Client" valeur={devis.nomClient} />
                <Info titre="Téléphone" valeur={devis.telephoneClient} />
                {devis.raisonSociale && <Info titre="Société" valeur={devis.raisonSociale} />}
                <Info titre="Adresse" valeur={`${devis.adresse}, ${devis.ville}`} />
                <Info titre="Véhicule" valeur={`${devis.vehiculeDescription || "—"} (${devis.categorieVehicule})`} />
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{devis.pack.nom}</span>
                  <span className="font-medium">
                    {devis.prixTotal - devis.options.reduce((total, o) => total + o.prix, 0)} €
                  </span>
                </div>
                {devis.options.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-[var(--muted)]">
                    <span>+ {o.nom}</span>
                    <span>{o.prix} €</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-2 font-semibold">
                   <span>Total</span>
                   <span>{devis.prixTotal} €</span>
                 </div>
                 <div className="flex items-center justify-between text-[var(--muted)]">
                   <span>Acompte à régler pour confirmer (10 %)</span>
                   <span>{devis.acompte} €</span>
                 </div>
               </div>
             </div>

          <DevisActions token={token} statut={devis.statut} />
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

