import { NextResponse } from "next/server";
import { db, ConflitDeVersion } from "@/lib/db";
import { rendezVousAvecRelations } from "@/lib/queries";
import {
  appliquerAffectation,
  changerStatut,
  conflitsOperateur,
  deplacerRendezVous,
  notifierAffectation,
  suppressionDefinitivePossible,
  trouverRendezVous,
} from "@/lib/rendezVous";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";
import { emailRendezVousAnnule, emailRendezVousDecale } from "@/lib/email";
import { MODELES_SMS, smsAuClient } from "@/lib/sms";
import { formatParis } from "@/lib/heure";
import { dateLocale } from "@/lib/disponibilites";
import type { RendezVous } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rendezVous = await rendezVousAvecRelations(id);
  if (!rendezVous) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }
  return NextResponse.json(rendezVous);
}

// Statuts que le back-office peut poser directement ; les étapes du
// terrain (en route, photos, paiement...) passent par le workflow opérateur.
const STATUTS_MANUELS = ["EN_ATTENTE", "CONFIRME", "ANNULE"] as const;

// Prévenir le client fait partie du geste : décaler ou annuler sans le dire
// n'a pas de sens. L'appelant peut s'en passer (body.notifier === false)
// quand il vient de l'avoir au téléphone.
async function prevenirClient(rdv: RendezVous, email: () => Promise<{ envoye: boolean; erreur?: string }>, sms: string, motif: "MODIFICATION_RDV" | "ANNULATION_RDV", par: string) {
  const resultat = await email();
  const envoiSms = await smsAuClient(rdv, sms, motif, par);
  return { email: resultat, sms: envoiSms ? { statut: envoiSms.statut, erreur: envoiSms.erreur } : null };
}

// Validation humaine : affecte l'opérateur choisi (proposé par le moteur
// ou sélectionné manuellement), change le statut, et/ou décale le RDV.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

    const rendezVous = await trouverRendezVous(id);
    if (!rendezVous) {
      return NextResponse.json({ error: "introuvable" }, { status: 404 });
    }
    if (body.operateurId && !(await db.operateur.findUnique({ where: { id: body.operateurId } }))) {
      return NextResponse.json({ error: "opérateur inconnu" }, { status: 400 });
    }
    if (body.statut != null && !STATUTS_MANUELS.includes(body.statut)) {
      return NextResponse.json({ error: "statut non modifiable depuis le back-office" }, { status: 400 });
    }

  // Décalage. La direction n'est pas tenue par les créneaux du site
  // (délai minimum, horizon de 21 jours) : au téléphone, on recale un RDV
  // pour demain matin. En revanche un chevauchement avec l'opérateur déjà
  // affecté est presque toujours une erreur de saisie — on la signale, et
  // elle reste forçable en connaissance de cause.
  let nouvelleDate: Date | null = null;
  if (body.jour != null || body.dateHeure != null) {
    // « jour » + « heure » sont interprétés à Paris par le serveur : le
    // back-office consulté depuis un autre fuseau ne décale pas le RDV.
    nouvelleDate =
      body.jour != null
        ? dateLocale(String(body.jour), String(body.heure ?? "00:00"))
        : new Date(body.dateHeure);
    if (Number.isNaN(nouvelleDate.getTime())) {
      return NextResponse.json({ error: "date invalide" }, { status: 400 });
    }
    if (nouvelleDate.getTime() < Date.now() && body.forcer !== true) {
      return NextResponse.json({ error: "cette date est passée", forcable: true }, { status: 409 });
    }
    if (rendezVous.operateurId && body.forcer !== true) {
      const conflits = await conflitsOperateur(rendezVous.operateurId, nouvelleDate, rendezVous.dureeMinutes, id);
      if (conflits.length > 0) {
        return NextResponse.json(
          {
            error: `L'opérateur a déjà ${conflits.length === 1 ? "un rendez-vous" : `${conflits.length} rendez-vous`} sur ce créneau (${conflits
              .map((c) => formatParis(c.dateHeure, { dateStyle: "short", timeStyle: "short" }))
              .join(", ")}).`,
            forcable: true,
          },
          { status: 409 }
        );
      }
    }
    if (nouvelleDate.getTime() === rendezVous.dateHeure.getTime()) nouvelleDate = null;
  }

  const envois: Record<string, unknown> = {};
  try {
    if (nouvelleDate) {
      const ancienneDate = rendezVous.dateHeure;
      await deplacerRendezVous(rendezVous, nouvelleDate);
      await journaliser({
        acteur: session,
        action: "RDV_DECALE",
        entite: "RendezVous",
        entiteId: id,
        details: { de: ancienneDate.toISOString(), vers: nouvelleDate.toISOString() },
      });
      if (body.notifier !== false) {
        envois.decalage = await prevenirClient(
          rendezVous,
          () => emailRendezVousDecale(rendezVous, ancienneDate),
          await MODELES_SMS.modificationClient(rendezVous),
          "MODIFICATION_RDV",
          session.email
        );
      }
    }
    if (body.statut != null && body.statut !== rendezVous.statut) {
      await changerStatut(rendezVous, body.statut);
      await journaliser({ acteur: session, action: `RDV_${body.statut}`, entite: "RendezVous", entiteId: id });
      if (body.statut === "ANNULE" && body.notifier !== false) {
        envois.annulation = await prevenirClient(
          rendezVous,
          () => emailRendezVousAnnule(rendezVous, typeof body.motif === "string" ? body.motif : null),
          await MODELES_SMS.annulationClient(rendezVous),
          "ANNULATION_RDV",
          session.email
        );
      }
    }
    // Nouvel opérateur : SMS automatiques à l'opérateur et au client.
    if (body.operateurId && (await appliquerAffectation(rendezVous, body.operateurId))) {
      await journaliser({ acteur: session, action: "RDV_AFFECTE", entite: "RendezVous", entiteId: id, details: {operateurId: body.operateurId } });
      await notifierAffectation(rendezVous, session.email);
    }
  } catch (e) {
    if (e instanceof ConflitDeVersion) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

    return NextResponse.json({ ...(await rendezVousAvecRelations(id)), envois });
}

// Suppression définitive. Réservée à la direction, et refusée dès que le
// RDV porte une trace comptable : une facture émise et un acompte encaissé
// se conservent (et se remboursent), ils ne s'effacent pas. Dans ce cas
// l'annulation — qui garde la ligne — est la bonne opération.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "RESPONSABLE") {
    return NextResponse.json({ error: "Seule la direction peut supprimer un rendez-vous." }, { status: 403 });
  }
  const { id } = await params;
  const rendezVous = await trouverRendezVous(id);
  if (!rendezVous) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const complet = await rendezVousAvecRelations(id);
  if (!suppressionDefinitivePossible(rendezVous)) {
    return NextResponse.json(
      {
        error:
          "Ce rendez-vous porte une facture ou un paiement encaissé : il doit être annulé, pas supprimé (la pièce comptable se conserve).",
        annulerPlutot: true,
      },
      { status: 409 }
    );
  }

  const notifier = new URL(request.url).searchParams.get("notifier") !== "false";
  let envois: unknown = null;
  if (notifier) {
    // Avant la suppression : après, il n'y a plus de client à qui écrire.
    envois = await prevenirClient(
      rendezVous,
      () => emailRendezVousAnnule(rendezVous, null),
      await MODELES_SMS.annulationClient(rendezVous),
      "ANNULATION_RDV",
      session.email
    );
  }

  // Le journal d'audit n'est jamais purgé : la ligne disparaît du planning,
  // pas la trace de qui l'a supprimée ni de ce qu'elle contenait.
  await journaliser({
    acteur: session,
    action: "RDV_SUPPRIME",
    entite: "RendezVous",
    entiteId: id,
    details: {
      dateHeure: rendezVous.dateHeure.toISOString(),
      statut: rendezVous.statut,
      prixTotal: rendezVous.prixTotal,
      client: complet?.client ? `${complet.client.prenom} ${complet.client.nom}` : null,
      pack: complet?.pack?.nom ?? null,
      operateurId: rendezVous.operateurId,
    },
  });
  await db.rendezVous.delete({ where: { id } });

  return NextResponse.json({ supprime: true, envois });
}
