import { NextResponse } from "next/server";
import { db, sansDecimal } from "@/lib/db";
import { listerOptionsActives } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";

export async function GET() {
  return NextResponse.json(await listerOptionsActives());
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const prix = Number(body?.prix);
  if (!body?.nom || !Number.isFinite(prix) || prix < 0) {
    return NextResponse.json({ error: "nom et prix requis" }, { status: 400 });
  }
  const option = await db.option.create({
    data: { nom: String(body.nom), prix, groupe: body.groupe ? String(body.groupe) : null },
  });
  await journaliser({ acteur: session, action: "OPTION_CREEE", entite: "Option", entiteId: option.id, details: {nom: option.nom, prix } });
  return NextResponse.json(sansDecimal(option), { status: 201 });
}

