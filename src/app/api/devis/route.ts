import { NextResponse } from "next/server";
import { db, genToken, premierEvenement } from "@/lib/db";
import { devisAvecRelations } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { calculerPrix } from "@/lib/rendezVous";
import { CATEGORIES_VEHICULE } from "@/lib/clients";
import { journaliser } from "@/lib/audit";

// Création d'un devis par le commercial ou le directeur. Le prix n'est
// jamais reçu du client : il est recalculé côté serveur depuis la grille
// PackTarif + options, exactement comme pour un RDV.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === "OPERATEUR" || session.role === "COMPTABLE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "corps invalide" }, { status: 400 });

  for (const champ of ["typeClient", "nomClient", "telephoneClient", "adresse", "ville", "categorieVehicule", "packId"]) {
    if (!body[champ]) return NextResponse.json({ error: `${champ} requis` }, { status: 400 });
  }
  if (body.typeClient !== "PARTICULIER" && body.typeClient !== "PRO") {
    return NextResponse.json({ error: "typeClient invalide" }, { status: 400 });
  }
  if (!CATEGORIES_VEHICULE.includes(body.categorieVehicule)) {
    return NextResponse.json({ error: "catégorie de véhicule invalide" }, { status: 400 });
  }

  const optionIds: string[] = Array.isArray(body.optionIds) ? body.optionIds.filter((id: unknown) => typeof id === "string") : [];
  const prix = await calculerPrix(body.packId, body.categorieVehicule, optionIds);
  if (!prix.ok) return NextResponse.json({ error: prix.erreur }, { status: 400 });

  const devis = await db.devis.create({
    data: {
      token: genToken(),
      typeClient: body.typeClient,
      nomClient: String(body.nomClient),
      telephoneClient: String(body.telephoneClient),
      emailClient: body.emailClient || null,
      raisonSociale: body.typeClient === "PRO" ? body.raisonSociale || null : null,
      adresse: String(body.adresse),
      ville: String(body.ville),
      vehiculeDescription: body.vehiculeDescription || "",
      categorieVehicule: body.categorieVehicule,
      packId: body.packId,
      optionIds,
      prixTotal: prix.valeur.prixTotal,
      acompte: prix.valeur.acompte,
      creeParUtilisateurId: session.sub,
      historique: premierEvenement("Devis créé."),
    },
  });
  await journaliser({ acteur: session, action: "DEVIS_CREE", entite: "Devis", entiteId: devis.id, details: { prixTotal: prix.valeur.prixTotal } });

    return NextResponse.json(await devisAvecRelations(devis.id), { status: 201 });
}

