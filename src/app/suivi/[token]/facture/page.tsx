import Link from "next/link";
import { notFound } from "next/navigation";
import { rendezVousParToken } from "@/lib/workflow";
import { factureParId } from "@/lib/facturation";
import FactureImprimable from "@/components/facture/FactureImprimable";
import BoutonImprimer from "./BoutonImprimer";

export const dynamic = "force-dynamic";

/**
 * La facture du client, à son lien de suivi.
 *
 * Jusqu'ici le client ne recevait qu'un récapitulatif par e-mail et un
 * numéro affiché à l'écran : rien qu'il puisse garder, imprimer ou
 * transmettre à son comptable. C'est la même facture que celle du
 * back-office, pas une version allégée.
 *
 * Public par jeton, comme le reste du suivi : le jeton est la clé privée du
 * dossier, il n'est ni devinable ni indexé.
 */
export default async function FactureClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rdv = await rendezVousParToken(token);
  if (!rdv) notFound();

  const facture = await factureParId(rdv.id);
  if (!facture) {
    return (
      <div className="site-clair min-h-screen bg-white px-5 py-10 text-black">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm">
            La facture sera disponible ici dès que la prestation sera clôturée et réglée.
          </p>
          <Link href={`/suivi/${token}`} className="mt-4 inline-block text-sm underline">
            ← Revenir au suivi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-clair min-h-screen bg-white px-5 py-8 text-black">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/suivi/${token}`} className="text-sm underline">
            ← Revenir au suivi
          </Link>
          <BoutonImprimer />
        </div>
        <FactureImprimable facture={facture} />
      </div>
    </div>
  );
}
