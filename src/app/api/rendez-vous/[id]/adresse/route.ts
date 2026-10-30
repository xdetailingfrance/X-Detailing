import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { geocoderDansLaZone } from "@/lib/deplacement";
import { historiserRdv } from "@/lib/db";
import { trouverRendezVous } from "@/lib/rendezVous";
import { journaliser } from "@/lib/audit";

/**
 * Corriger l'adresse d'intervention d'un rendez-vous.
 *
 * Une adresse que le géocodeur ne reconnaît pas — « Carignan » sans code
 * postal, un libellé approximatif — rend le dossier inaffectable. Sans ce
 * correctif accessible depuis la fiche, il faudrait passer par la base.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const rdv = await trouverRendezVous(id);
  if (!rdv) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const lire = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const adresse = lire(body?.adresse, 160);
  const ville = lire(body?.ville, 80);
  const codePostal = lire(body?.codePostal, 10) || null;
  if (!ville) return NextResponse.json({ error: "La ville est obligatoire." }, { status: 400 });

  const point = await geocoderDansLaZone(adresse, ville, codePostal);
  const ancienne = await db.adresse.findUnique({ where: { id: rdv.adresseId } });
  await db.adresse.update({
    where: { id: rdv.adresseId },
    data: {
      adresse,
      ville,
      codePostal,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
    },
  });
  await historiserRdv(
    rdv,
    `Adresse corrigée : « ${ancienne?.adresse ?? ""} ${ancienne?.ville ?? ""} » → « ${adresse} ${codePostal ?? ""} ${ville} »${point ? "" : " (toujours non reconnue)"}`
  );
  await journaliser({
    acteur: session,
    action: "RDV_ADRESSE_CORRIGEE",
    entite: "RendezVous",
    entiteId: id,
    details: { adresse, ville, codePostal, geocodee: point != null },
  });

  return NextResponse.json({
    geocodee: point != null,
    erreur: point
      ? undefined
      : "Adresse toujours introuvable près de Bordeaux. Vérifiez le numéro, le code postal et la ville.",
  });
}
