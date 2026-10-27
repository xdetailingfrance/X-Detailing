import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { convertirDevisEnRdv, trouverDevis } from "@/lib/devis";
import { lireDateSaisie } from "@/lib/heure";
import { journaliser } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "OPERATEUR" || session.role === "COMPTABLE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

    const { id } = await params;
    const devis = await trouverDevis(id);
    if (!devis) return NextResponse.json({ error: "introuvable" }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body?.dateHeure) return NextResponse.json({ error: "dateHeure requise" }, { status: 400 });
    const dateHeure = lireDateSaisie(body.dateHeure);
    if (Number.isNaN(dateHeure.getTime())) {
      return NextResponse.json({ error: "dateHeure invalide" }, { status: 400 });
    }

  const resultat = await convertirDevisEnRdv(devis, dateHeure);
  if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: 400 });
  await journaliser({ acteur: session, action: "DEVIS_CONVERTI", entite: "Devis", entiteId: id, details: { rendezVousId: resultat.rendezVousId } });

    return NextResponse.json({ rendezVousId: resultat.rendezVousId });
}

