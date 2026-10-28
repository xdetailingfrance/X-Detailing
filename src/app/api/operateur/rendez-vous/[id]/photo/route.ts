import { NextResponse } from "next/server";
import { ConflitDeVersion } from "@/lib/db";
import { deposerPhoto, type EtapePhoto } from "@/lib/photos";
import { rendezVousAvecRelations } from "@/lib/queries";
import { trouverRendezVous } from "@/lib/rendezVous";
import { getSession } from "@/lib/session";
import { ANGLES_PHOTO, type AnglePhoto } from "@/lib/types";
import { appliquerActionWorkflow } from "@/lib/workflow";

/**
 * Dépôt d'une photo de prestation par l'opérateur assigné.
 *
 * L'image part d'abord vers le stockage privé ; l'angle n'est coché qu'une
 * fois le dépôt réussi. Dans l'autre sens, un échec réseau laisserait une
 * étape validée sans photo — et le workflow, lui, se fie à cette coche pour
 * autoriser la suite.
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

  const formulaire = await request.formData().catch(() => null);
  if (!formulaire) return NextResponse.json({ error: "envoi invalide" }, { status: 400 });

  const etape = String(formulaire.get("etape") ?? "");
  const angle = String(formulaire.get("angle") ?? "");
  const fichier = formulaire.get("fichier");

  if (etape !== "avant" && etape !== "apres") {
    return NextResponse.json({ error: "étape invalide" }, { status: 400 });
  }
  if (!ANGLES_PHOTO.includes(angle as AnglePhoto)) {
    return NextResponse.json({ error: "angle invalide" }, { status: 400 });
  }
  if (!(fichier instanceof File)) {
    return NextResponse.json({ error: "photo manquante" }, { status: 400 });
  }

  const depot = await deposerPhoto(rdv.id, etape as EtapePhoto, angle as AnglePhoto, fichier);
  if (!depot.ok) return NextResponse.json({ error: depot.error }, { status: 400 });

  try {
    const resultat = await appliquerActionWorkflow(rdv, {
      type: etape === "avant" ? "PHOTO_AVANT" : "PHOTO_APRES",
      angle: angle as AnglePhoto,
      chemin: depot.chemin,
    });
    if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: 400 });
  } catch (e) {
    if (e instanceof ConflitDeVersion) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  return NextResponse.json(await rendezVousAvecRelations(rdv.id));
}
