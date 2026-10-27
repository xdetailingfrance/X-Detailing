import { NextResponse } from "next/server";
import { db, sansDecimal } from "@/lib/db";
import { getSession } from "@/lib/session";
import { moisParis } from "@/lib/heure";
import { journaliser } from "@/lib/audit";

// Dépenses globales + coût publicitaire du mois, éditables par le
// directeur uniquement (vérifié ici en plus du proxy).
export async function PATCH(request: Request) {
  const session = await getSession();
  if (session?.role !== "OWNER") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

   const body = await request.json().catch(() => null);
   const depenses = Number(body?.depenses);
   const publicite = Number(body?.publicite);
   if (!Number.isFinite(depenses) || depenses < 0 || !Number.isFinite(publicite) || publicite < 0) {
     return NextResponse.json({ error: "valeurs invalides" }, { status: 400 });
   }

  const mois = moisParis();
  const entree = await db.depensesMensuelles.upsert({
    where: { mois },
    update: { depenses, publicite },
    create: { mois, depenses, publicite },
  });
  await journaliser({ acteur: session, action: "DEPENSES_MOIS_MODIFIEES", entite: "DepensesMensuelles", entiteId:entree.id, details: { mois, depenses, publicite } });
  return NextResponse.json(sansDecimal(entree));
}

