import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES_VEHICULE, creerClient } from "@/lib/clients";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";

// Recherche par nom, prénom ou téléphone (50 résultats au plus).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const chiffres = q.replace(/\D/g, "");
  const clients = await db.client.findMany({
    where: q
      ? {
          OR: [
            { nom: { contains: q, mode: "insensitive" } },
            { prenom: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            ...(chiffres.length >= 4 ? [{ telephone: { contains: chiffres.slice(-4) } }] : []),
          ],
        }
      : undefined,
    include: { adresses: true, vehicules: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(clients);
}

// Crée un client, avec en option sa première adresse et son premier véhicule.
export async function POST(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    const body = await request.json().catch(() => null);
    for (const champ of ["prenom", "nom", "telephone"]) {
      if (!body?.[champ] || typeof body[champ] !== "string") {
        return NextResponse.json({ error: `${champ} requis` }, { status: 400 });
      }
    }
    if (body.vehicule && !CATEGORIES_VEHICULE.includes(body.vehicule.categorie)) {
      return NextResponse.json({ error: "catégorie de véhicule invalide" }, { status: 400 });
    }
    if (body.adresse && (!body.adresse.adresse || !body.adresse.ville)) {
      return NextResponse.json({ error: "adresse et ville requises" }, { status: 400 });
    }

    const client = await creerClient({
      prenom: body.prenom.trim(),
      nom: body.nom.trim(),
      telephone: body.telephone.trim(),
      email: body.email || null,
      adresse: body.adresse ?? null,
      vehicule: body.vehicule ?? null,
    });
    await journaliser({ acteur: session, action: "CLIENT_CREE", entite: "Client", entiteId: client.id });
    return NextResponse.json(client, { status: 201 });
}

