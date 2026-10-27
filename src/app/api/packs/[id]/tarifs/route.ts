import { NextResponse } from "next/server";
import { db, sansDecimal } from "@/lib/db";
import { CATEGORIES_VEHICULE } from "@/lib/clients";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";
import type { CategorieVehicule } from "@/lib/types";

// Grille de prix administrable par catégorie de véhicule. Un upsert : le
// prix des RDV déjà créés ne change jamais, seulement la grille de
// référence pour les prochains.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const categorie = body?.categorie as CategorieVehicule;
  const prix = Number(body?.prix);
  if (!CATEGORIES_VEHICULE.includes(categorie) || !Number.isFinite(prix) || prix < 0) {
    return NextResponse.json({ error: "categorie et prix requis" }, { status: 400 });
  }
  if (!(await db.pack.findUnique({ where: { id } }))) return NextResponse.json({ error: "pack introuvable" }, { status: 404 });

    const avant = await db.packTarif.findUnique({ where: { packId_categorie: { packId: id, categorie } } });
    const tarif = await db.packTarif.upsert({
      where: { packId_categorie: { packId: id, categorie } },
      update: { prix },
      create: { packId: id, categorie, prix },
    });
    await journaliser({
      acteur: session,
      action: "TARIF_MODIFIE",
      entite: "PackTarif",
      entiteId: tarif.id,
      details: { packId: id, categorie, avant: avant ? avant.prix.toNumber() : null, apres: prix },
    });
    return NextResponse.json(sansDecimal(tarif));
}

