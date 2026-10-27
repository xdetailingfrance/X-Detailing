import { NextResponse } from "next/server";
import { db, ConflitDeVersion } from "@/lib/db";
import { rendezVousAvecRelations } from "@/lib/queries";
import { appliquerAffectation, changerStatut, notifierAffectation, trouverRendezVous } from "@/lib/rendezVous";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";

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

// Validation humaine : affecte l'opérateur choisi (proposé par le moteur
// ou sélectionné manuellement) et/ou change le statut.
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

  try {
    if (body.statut != null && body.statut !== rendezVous.statut) {
      await changerStatut(rendezVous, body.statut);
      await journaliser({ acteur: session, action: `RDV_${body.statut}`, entite: "RendezVous", entiteId: id });
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

    return NextResponse.json(await rendezVousAvecRelations(id));
}

