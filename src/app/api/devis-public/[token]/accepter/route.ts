import { NextResponse } from "next/server";
import { devisParToken, accepterDevis } from "@/lib/devis";
import { journaliser } from "@/lib/audit";

// Endpoint public (jeton non devinable, voir /devis/[token]) : le client
// accepte son devis sans authentification.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const devis = await devisParToken(token);
  if (!devis) return NextResponse.json({ error: "introuvable" }, { status: 404 });

    const resultat = await accepterDevis(devis);
    if (!resultat.ok) return NextResponse.json({ error: resultat.error }, { status: 400 });
    await journaliser({ acteur: "client", action: "DEVIS_ACCEPTE", entite: "Devis", entiteId: devis.id });

    return NextResponse.json({ statut: devis.statut });
}

