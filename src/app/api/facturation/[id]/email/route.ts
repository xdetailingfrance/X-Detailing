import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { trouverRendezVous } from "@/lib/rendezVous";
import { emailFacture } from "@/lib/email";
import { journaliser } from "@/lib/audit";

// Renvoi de la facture par e-mail. L'envoi automatique de la clôture peut
// avoir échoué sans que personne ne s'en aperçoive ; il faut pouvoir le
// reprendre, et savoir si ça a marché.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "finances")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const rdv = await trouverRendezVous(id);
  if (!rdv) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  if (!rdv.numeroFacture) {
    return NextResponse.json({ error: "Ce rendez-vous n'a pas encore de facture." }, { status: 400 });
  }

  const envoi = await emailFacture(rdv);
  await journaliser({
    acteur: session,
    action: "FACTURE_RENVOYEE",
    entite: "RendezVous",
    entiteId: id,
    details: { numeroFacture: rdv.numeroFacture, envoye: envoi.envoye, ...(envoi.erreur ? { erreur: envoi.erreur } : {}) },
  });

  return NextResponse.json(envoi);
}
