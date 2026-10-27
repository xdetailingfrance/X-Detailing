import { NextResponse } from "next/server";
import { devisAvecRelations } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { envoyerDevis, trouverDevis } from "@/lib/devis";
import { journaliser } from "@/lib/audit";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "OPERATEUR" || session.role === "COMPTABLE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

    const { id } = await params;
    const devis = await trouverDevis(id);
    if (!devis) return NextResponse.json({ error: "introuvable" }, { status: 404 });

    const resultat = await envoyerDevis(devis);
    if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: 400 });
    await journaliser({ acteur: session, action: "DEVIS_ENVOYE", entite: "Devis", entiteId: id });

    return NextResponse.json(await devisAvecRelations(id));
}

