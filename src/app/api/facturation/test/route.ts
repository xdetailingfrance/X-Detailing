import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { emailFactureTest } from "@/lib/email";
import { journaliser } from "@/lib/audit";

// Envoi de contrôle de la facture, à une adresse choisie. Réservé à la
// direction : c'est un outil de vérification, pas un moyen d'adresser une
// facture à qui l'on veut.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "finances")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const destinataire = typeof body?.email === "string" ? body.email.trim() : "";
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(destinataire)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  const envoi = await emailFactureTest(destinataire);
  await journaliser({
    acteur: session,
    action: "EMAIL_TEST_FACTURE",
    entite: "Systeme",
    entiteId: "test",
    details: { destinataire, envoye: envoi.envoye, ...(envoi.erreur ? { erreur: envoi.erreur } : {}) },
  });
  return NextResponse.json(envoi);
}
