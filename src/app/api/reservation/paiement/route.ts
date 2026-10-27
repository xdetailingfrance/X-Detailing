import { NextResponse } from "next/server";
import { enregistrerPaiement, libererReservation, paiementEnLigneActif, stripe, type MetadonneesReservation } from "@/lib/paiement";

// Retour du client après Stripe Checkout. Le statut est TOUJOURS relu
// auprès de Stripe : seul payment_status === "paid" confirme la
// réservation. ?annuler=1 (retour « annuler ») libère le créneau.
export async function GET(request: Request) {
  if (!paiementEnLigneActif()) return NextResponse.json({ error: "Paiement en ligne non configuré" }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return NextResponse.json({ error: "Session invalide" }, { status: 400 });

    let session;
    try {
      session = await stripe().checkout.sessions.retrieve(sessionId);
    } catch {
      return NextResponse.json({ error: "Session de paiement introuvable" }, { status: 404 });
    }
    const meta = (session.metadata ?? {}) as Partial<MetadonneesReservation>;

    if (session.payment_status === "paid") {
      if (meta.rdvId) await enregistrerPaiement(meta.rdvId, session.id);
      return NextResponse.json({
        paye: true,
        packId: meta.packId,
        prenom: meta.prenom ?? "",
        confirmation: {
          reference: meta.reference ?? "",
          prestation: meta.prestation ?? "",
          options: meta.options ? meta.options.split(" + ") : [],
          quand: meta.quand ?? "",
          adresse: meta.adresse ?? "",
          prixTotal: Number(meta.prixTotal ?? 0),
          acompte: Number(meta.acompte ?? 0),
          paye: true,
          smsEnvoye: false,
        },
      });
    }

    if (searchParams.get("annuler") === "1" && session.status === "open") {
      await stripe().checkout.sessions.expire(session.id).catch(() => null);
      if (meta.rdvId) await libererReservation(meta.rdvId, "Paiement annulé par le client : créneau libéré.");
    }
    return NextResponse.json({ paye: false, statut: session.status });
}

