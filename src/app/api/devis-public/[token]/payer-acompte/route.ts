import { NextResponse } from "next/server";
import { devisParToken } from "@/lib/devis";
import { creerSessionPaiementDevis, paiementEnLigneActif } from "@/lib/paiement";

// Paiement de l'acompte d'un devis accepté par Stripe Checkout. Rien n'est
// simulé : sans Stripe configuré, le paiement en ligne est indisponible et
// le devis reste « accepté » jusqu'au règlement. Le devis ne passe à
// « acompte payé » qu'après validation par Stripe (retour client vérifié
// côté serveur ou webhook).
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const devis = await devisParToken(token);
  if (!devis) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (devis.statut !== "ACCEPTE") return NextResponse.json({ error: "Le devis doit d'abord être accepté." }, { status: 400 });
  if (!paiementEnLigneActif()) {
    return NextResponse.json(
      { error: "Le paiement en ligne n'est pas encore disponible : X Detailing vous contacte pour le règlement del'acompte." },
      { status: 409 }
    );
    }

    try {
      const session = await creerSessionPaiementDevis(devis, new URL(request.url).origin);
      return NextResponse.json({ paiement: { url: session.url } });
    } catch (e) {
      console.error("Stripe : session de paiement du devis impossible", e);
      return NextResponse.json({ error: "Le paiement sécurisé est momentanément indisponible." }, { status: 502 });
    }
}

