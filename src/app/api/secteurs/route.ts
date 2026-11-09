import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";

export async function GET() {
  return NextResponse.json(await db.secteur.findMany({ orderBy: { nom: "asc" } }));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body?.nom) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }
  const secteur = await db.secteur.create({ data: { nom: String(body.nom), ville: body.ville ? String(body.ville) : null } });
  await journaliser({ acteur: session, action: "SECTEUR_CREE", entite: "Secteur", entiteId: secteur.id });
  return NextResponse.json(secteur, { status: 201 });
}

