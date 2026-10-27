import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const operateurs = await db.operateur.findMany({ include: { secteur: true }, orderBy: [{ statut: "asc" }, { nom: "asc" }] });
  return NextResponse.json(operateurs);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null);
  for (const champ of ["prenom", "nom", "telephone"]) {
    if (!body?.[champ]) {
      return NextResponse.json({ error: `${champ} requis` }, { status: 400 });
    }
  }
  for (const champ of ["heureDebut", "heureFin"]) {
    if (body[champ] != null && !HEURE.test(body[champ])) return NextResponse.json({ error: `${champ} invalide (HH:mm)` }, { status: 400 });
  }

    const nombre = (v: unknown) => (v == null || v === "" ? null : Number(v));
    const operateur = await db.operateur.create({
      data: {
        prenom: String(body.prenom),
        nom: String(body.nom),
        telephone: String(body.telephone),
        email: body.email ? String(body.email) : null,
        secteurId: body.secteurId || null,
        adresseDomicile: body.adresseDomicile || null,
        latitudeDomicile: nombre(body.latitudeDomicile),
        longitudeDomicile: nombre(body.longitudeDomicile),
        heureDebut: body.heureDebut ?? "08:30",
        heureFin: body.heureFin ?? "17:30",
        kangooImmatriculation: body.kangooImmatriculation || null,
      },
    });
    await journaliser({ acteur: session, action: "OPERATEUR_CREE", entite: "Operateur", entiteId: operateur.id });
    return NextResponse.json(operateur, { status: 201 });
}

