import { NextResponse } from "next/server";
import { enregistrerPaiement, enregistrerPaiementDevis, enregistrerPaiementSolde, libererReservation, paiementEnLigneActif, stripe } from "@/lib/paiement";

// Webhook Stripe (à déclarer dans le tableau de bord Stripe avec les
// événements checkout.session.completed, checkout.session.async_payment_succeeded
// et checkout.session.expired). La signature est vérifiée avec
// STRIPE_WEBHOOK_SECRET : sans elle, aucun événement n'est accepté.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!paiementEnLigneActif() || !secret) return NextResponse.json({ error: "Webhook non configuré" }, { status:503 });

  const corps = await request.text();
  let evenement;
  try {
    evenement = await stripe().webhooks.constructEventAsync(corps, request.headers.get("stripe-signature") ?? "",secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (
    evenement.type === "checkout.session.completed" ||
    evenement.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = evenement.data.object;
    if (session.payment_status === "paid" && session.metadata?.type === "devis" && session.metadata.devisId) {
      await enregistrerPaiementDevis(session.metadata.devisId, session.id);
    } else if (session.payment_status === "paid" && session.metadata?.type === "solde" && session.metadata.rdvId) {
      // Solde réglé par carte : Stripe atteste, le dossier se clôture seul.
      await enregistrerPaiementSolde(session.metadata.rdvId, session.id);
    } else if (session.payment_status === "paid" && session.metadata?.rdvId) {
      await enregistrerPaiement(session.metadata.rdvId, session.id);
    }
  } else if (evenement.type === "checkout.session.expired") {
    const session = evenement.data.object;
    // Un solde expiré n'annule rien : la prestation a été réalisée, elle
    // reste due. Seule une réservation non payée libère son créneau.
    if (session.metadata?.rdvId && session.metadata.type !== "solde") {
      await libererReservation(session.metadata.rdvId, "Paiement non finalisé (session Stripe expirée) : créneau libéré.");
    }
  }
  return NextResponse.json({ recu: true });
}

