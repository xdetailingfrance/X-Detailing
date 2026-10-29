import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { journaliser } from "@/lib/audit";
import { geocoderAdresse } from "@/lib/geo";

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
    // Les coordonnées ne sont pas demandées au formulaire : on les déduit de
    // l'adresse. Sans elles, l'opérateur serait créé puis écarté en silence
    // par le moteur d'affectation, sans que personne ne comprenne pourquoi.
    const adresseDomicile = body.adresseDomicile ? String(body.adresseDomicile) : null;
    let latitude = nombre(body.latitudeDomicile);
    let longitude = nombre(body.longitudeDomicile);
    if (adresseDomicile && (latitude == null || longitude == null)) {
      const point = await geocoderAdresse(adresseDomicile, "", null);
      latitude = point?.latitude ?? null;
      longitude = point?.longitude ?? null;
    }
    const operateur = await db.operateur.create({
      data: {
        prenom: String(body.prenom),
        nom: String(body.nom),
        telephone: String(body.telephone),
        email: body.email ? String(body.email) : null,
        secteurId: body.secteurId || null,
        adresseDomicile,
        latitudeDomicile: latitude,
        longitudeDomicile: longitude,
        heureDebut: body.heureDebut ?? "08:30",
        heureFin: body.heureFin ?? "18:00",
        kangooImmatriculation: body.kangooImmatriculation || null,
      },
    });
    await journaliser({ acteur: session, action: "OPERATEUR_CREE", entite: "Operateur", entiteId: operateur.id });
    return NextResponse.json(operateur, { status: 201 });
}

