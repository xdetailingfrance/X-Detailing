import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";
import { geocoderDansLaZone } from "@/lib/deplacement";

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  if (!(await db.operateur.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "opérateur introuvable" }, { status: 404 });
  }
  if (body.statut != null && body.statut !== "ACTIF" && body.statut !== "SUSPENDU") {
    return NextResponse.json({ error: "statut invalide" }, { status: 400 });
  }
  for (const champ of ["heureDebut", "heureFin"]) {
    if (body[champ] != null && !HEURE.test(body[champ])) return NextResponse.json({ error: `${champ} invalide (HH:mm)` }, { status: 400 });
  }

  // Une adresse de domicile modifiée est regéocodée : garder les anciennes
  // coordonnées enverrait l'opérateur depuis un point où il n'habite plus.
  let position: { latitudeDomicile: number | null; longitudeDomicile: number | null } | undefined;
  if (typeof body.adresseDomicile === "string") {
    const point = body.adresseDomicile.trim() ? await geocoderDansLaZone(body.adresseDomicile, "", null) : null;
    position = { latitudeDomicile: point?.latitude ?? null, longitudeDomicile: point?.longitude ?? null };
  }

  const operateur = await db.operateur.update({
    where: { id },
    data: {
      statut: body.statut ?? undefined,
      secteurId: body.secteurId ?? undefined,
      heureDebut: body.heureDebut ?? undefined,
      heureFin: body.heureFin ?? undefined,
      adresseDomicile: typeof body.adresseDomicile === "string" ? body.adresseDomicile.trim() || null : undefined,
      ...(position ?? {}),
    },
  });
  await journaliser({ acteur: session, action: "OPERATEUR_MODIFIE", entite: "Operateur", entiteId: id, details: body });
  return NextResponse.json(operateur);
}

