// Paiement de l'acompte des réservations en ligne avec Stripe Checkout.
//
// Actif dès que STRIPE_SECRET_KEY est défini. Rien n'est jamais simulé :
// une réservation n'est confirmée (SMS, écran final) qu'après que Stripe a
// validé le paiement — au retour du client (vérification de la session
// côté serveur) ou par le webhook checkout.session.completed.
//
// En attendant le paiement, le RDV bloque son créneau 30 minutes (durée de
// vie de la session Stripe) ; au-delà, ou si le client annule, il est
// annulé et le créneau libéré.
import Stripe from "stripe";
import type { Devis, RendezVous } from "@/lib/types";
import { db, enregistrerRdv, historiserDevis, historiserRdv, versRdv } from "@/lib/db";
import { changerStatut, trouverRendezVous } from "@/lib/rendezVous";
import { emailConfirmationReservation } from "@/lib/email";
import { MODELES_SMS, smsAuClient } from "@/lib/sms";
import { journaliser } from "@/lib/audit";

export const DUREE_BLOCAGE_MINUTES = 30;

export function paiementEnLigneActif() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;
export function stripe() {
  if (!client) {
    // STRIPE_API_HOST : uniquement pour pointer vers stripe-mock en test.
    const hote = process.env.STRIPE_API_HOST ? new URL(process.env.STRIPE_API_HOST) : null;
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      ...(hote
        ? { host: hote.hostname, port: hote.port, protocol: hote.protocol.replace(":", "") as "http" | "https" }
        : {}),
    });
  }
  return client;
}

// Données affichées au client après paiement, portées par la session
// Stripe elle-même (fiable même si une autre instance traite le retour).
export type MetadonneesReservation = {
  rdvId: string;
  reference: string;
  prestation: string;
  options: string;
  quand: string;
  adresse: string;
  prixTotal: string;
  acompte: string;
  prenom: string;
  packId: string;
};

export async function creerSessionPaiement(params: {
  rdv: RendezVous;
  metadonnees: MetadonneesReservation;
  email: string | null;
  origine: string;
}) {
  const { rdv, metadonnees } = params;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    client_reference_id: rdv.id,
    customer_email: params.email ?? undefined,
    expires_at: Math.floor(Date.now() / 1000) + DUREE_BLOCAGE_MINUTES * 60,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(rdv.acompte * 100),
          product_data: {
            name: `Acompte 10 % — ${metadonnees.prestation}${metadonnees.options ? ` + ${metadonnees.options}` :""}`,
            description: `${metadonnees.quand} · ${metadonnees.adresse} · total ${metadonnees.prixTotal} €`,
          },
        },
      },
    ],
    metadata: metadonnees,
    success_url: `${params.origine}/?paiement=reussi&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origine}/?paiement=annule&session_id={CHECKOUT_SESSION_ID}`,
  });
  rdv.stripeSessionId = session.id;
  rdv.acompteStatut = "EN_ATTENTE_PAIEMENT";
  await enregistrerRdv(rdv);
  await historiserRdv(rdv, "En attente du paiement de l'acompte (Stripe).");
  return session;
}

// Paiement validé par Stripe : acompte payé, RDV confirmé côté client
// (SMS de confirmation, une seule fois). Idempotent : le passage à PAYE est
// une écriture conditionnelle, un seul appel (retour client ou webhook)
// peut la réaliser.
export async function enregistrerPaiement(rdvId: string, sessionId: string) {
  const bascule = await db.rendezVous.updateMany({
    where: { id: rdvId, acompteStatut: { not: "PAYE" } },
    data: { acompteStatut: "PAYE", stripeSessionId: sessionId, version: { increment: 1 } },
  });
  const rdv = await trouverRendezVous(rdvId);
  if (!rdv || bascule.count === 0) return rdv;

  await journaliser({ acteur: "stripe", action: "ACOMPTE_PAYE", entite: "RendezVous", entiteId: rdv.id, details:{ sessionId, acompte: rdv.acompte } });
  if (rdv.statut === "ANNULE") {
    // Payé après expiration du blocage : on le rétablit, à vérifier par l'équipe.
    await changerStatut(rdv, "EN_ATTENTE");
    await historiserRdv(rdv, "Payé après expiration : créneau à vérifier.");
  }
  await historiserRdv(rdv, `Acompte de ${rdv.acompte} € payé (Stripe).`);
  const dejaEnvoye = await db.sms.count({ where: { rendezVousId: rdv.id, motif: "CONFIRMATION_RDV" } });
  if (!dejaEnvoye) {
    await smsAuClient(rdv, await MODELES_SMS.confirmationClient(rdv), "CONFIRMATION_RDV", "site");
    await emailConfirmationReservation(rdv);
  }
  return rdv;
}

// Paiement abandonné ou expiré : le créneau est libéré (jamais si payé).
export async function libererReservation(rdvId: string, raison: string) {
  const rdv = await trouverRendezVous(rdvId);
  if (!rdv || rdv.acompteStatut === "PAYE" || rdv.statut === "ANNULE") return;
  await changerStatut(rdv, "ANNULE");
  await historiserRdv(rdv, raison);
}

// Filet de sécurité sans webhook : libère les créneaux bloqués depuis plus
// longtemps que la session Stripe.
export async function libererReservationsExpirees() {
  const limite = new Date(Date.now() - (DUREE_BLOCAGE_MINUTES + 5) * 60000);
  const expirees = await db.rendezVous.findMany({
      where: { acompteStatut: "EN_ATTENTE_PAIEMENT", statut: { not: "ANNULE" }, createdAt: { lt: limite } },
    });
    for (const r of expirees.map(versRdv)) {
      await libererReservation(r.id, "Paiement non finalisé dans les 30 minutes : créneau libéré.").catch((e) =>
        console.error("Libération de réservation expirée en échec", r.id, e)
      );
    }
}

// ---------------------------------------------------------------------------
// Acompte d'un devis accepté (page publique /devis/[token])
// ---------------------------------------------------------------------------

export async function creerSessionPaiementDevis(devis: Devis, origine: string) {
  const pack = await db.pack.findUnique({ where: { id: devis.packId } });
  return stripe().checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    client_reference_id: devis.id,
    customer_email: devis.emailClient ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(devis.acompte * 100),
          product_data: {
            name: `Acompte 10 % — devis X Detailing${pack ? ` (${pack.nom})` : ""}`,
            description: `Total du devis ${devis.prixTotal} €`,
          },
        },
      },
    ],
    metadata: { type: "devis", devisId: devis.id },
    success_url: `${origine}/devis/${devis.token}?paiement=reussi&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/devis/${devis.token}?paiement=annule`,
  });
}

// Acompte du devis validé par Stripe. Idempotent (écriture conditionnelle).
export async function enregistrerPaiementDevis(devisId: string, sessionId: string) {
  const bascule = await db.devis.updateMany({
    where: { id: devisId, statut: "ACCEPTE" },
    data: { statut: "ACOMPTE_PAYE", acomptePayeAt: new Date() },
  });
  if (bascule.count === 0) return;
  const devis = await db.devis.findUniqueOrThrow({ where: { id: devisId } });
  await historiserDevis({ id: devis.id, historique: [] }, `Acompte de ${devis.acompte.toNumber()} € payé (Stripe)— prêt pour le rendez-vous.`);
  await journaliser({ acteur: "stripe", action: "ACOMPTE_DEVIS_PAYE", entite: "Devis", entiteId: devisId, details: { sessionId } });
}

// Retour du client sur /devis/[token] après Stripe : la session est relue
// chez Stripe, seul payment_status === "paid" valide l'acompte.
export async function verifierRetourPaiementDevis(devisId: string, sessionId: string) {
  if (!paiementEnLigneActif() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false;
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" || session.metadata?.devisId !== devisId) return false;
    await enregistrerPaiementDevis(devisId, session.id);
    return true;
  } catch {
    return false;
  }
}

