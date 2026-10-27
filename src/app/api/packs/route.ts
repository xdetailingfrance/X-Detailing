import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listerPacksAvecTarifs } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";

export async function GET() {
  return NextResponse.json(await listerPacksAvecTarifs());
}

// Création d'un pack — la grille de prix se paramètre ensuite via
// /api/packs/[id]/tarifs.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const dureeMin = Number(body?.dureeMinMinutes);
  const dureeMax = Number(body?.dureeMaxMinutes);
  if (!body?.nom || !Number.isInteger(dureeMin) || !Number.isInteger(dureeMax) || dureeMin <= 0 || dureeMax < dureeMin) {
    return NextResponse.json({ error: "nom, dureeMinMinutes et dureeMaxMinutes requis" }, { status: 400 });
  }

  const pack = await db.pack.create({
    data: { nom: String(body.nom), description: body.description ? String(body.description) : null, dureeMinMinutes: dureeMin, dureeMaxMinutes: dureeMax },
  });
  await journaliser({ acteur: session, action: "PACK_CREE", entite: "Pack", entiteId: pack.id, details: { nom: pack.nom } });
  return NextResponse.json(pack, { status: 201 });
}

