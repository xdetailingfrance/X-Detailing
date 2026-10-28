import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trouverRendezVous } from "@/lib/rendezVous";
import { getSession } from "@/lib/session";

/**
 * Position de l'opérateur pendant son trajet.
 *
 * N'est acceptée que tant que le rendez-vous est EN_ROUTE : hors trajet, la
 * position d'un salarié ne regarde pas l'application. Elle écrase la
 * précédente — aucune trace n'est conservée.
 *
 * Écriture directe plutôt que passage par le workflow : ce n'est pas une
 * transition d'état, et faire tourner le verrou optimiste toutes les quinze
 * secondes entrerait en conflit avec les actions réelles de l'opérateur.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.operateurId) {
    return NextResponse.json({ error: "Non authentifié comme opérateur" }, { status: 401 });
  }

  const { id } = await params;
  const rdv = await trouverRendezVous(id);
  if (!rdv) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (rdv.operateurId !== session.operateurId) {
    return NextResponse.json({ error: "Ce rendez-vous n'est pas affecté à votre compte." }, { status: 403 });
  }
  if (rdv.statut !== "EN_ROUTE") {
    return NextResponse.json({ error: "Trajet non commencé." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    return NextResponse.json({ error: "position invalide" }, { status: 400 });
  }

  await db.rendezVous.update({
    where: { id: rdv.id },
    data: { positionLatitude: latitude, positionLongitude: longitude, positionAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
