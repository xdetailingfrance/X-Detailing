import { NextResponse } from "next/server";
import { devisAvecRelations } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { envoyerDevis, renvoyerDevis, trouverDevis } from "@/lib/devis";
import { journaliser } from "@/lib/audit";

// Premier envoi (le devis quitte l'état brouillon) ou renvoi de l'e-mail
// d'un devis déjà envoyé. Le second cas est indispensable : un envoi échoué
// serait sinon définitif.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "OPERATEUR" || session.role === "COMPTABLE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

    const { id } = await params;
    const devis = await trouverDevis(id);
    if (!devis) return NextResponse.json({ error: "introuvable" }, { status: 404 });

    const premier = devis.statut === "BROUILLON";
    const resultat = premier ? await envoyerDevis(devis) : await renvoyerDevis(devis);
    if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: 400 });
    await journaliser({
      acteur: session,
      action: premier ? "DEVIS_ENVOYE" : "DEVIS_RENVOYE",
      entite: "Devis",
      entiteId: id,
      details: { envoye: resultat.envoi.envoye, ...(resultat.envoi.erreur ? { erreur: resultat.envoi.erreur } : {}) },
    });

    // Le statut a pu passer à « envoyé » alors que l'e-mail n'est pas parti :
    // l'écran doit pouvoir le dire.
    return NextResponse.json({ ...(await devisAvecRelations(id)), envoi: resultat.envoi });
}
