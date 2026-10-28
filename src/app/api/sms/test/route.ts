import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { envoyerSms, fournisseurSms, normaliserTelephone } from "@/lib/sms";
import { journaliser } from "@/lib/audit";

// Envoi d'un SMS de contrôle à un numéro choisi. Sans cela, la seule façon
// de vérifier qu'un fournisseur est bien branché serait de créer une vraie
// réservation — et d'encaisser un acompte pour rien.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.role !== "OWNER" && session.role !== "RESPONSABLE") {
    return NextResponse.json({ error: "Réservé à la direction." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const telephone = typeof body?.telephone === "string" ? body.telephone.trim() : "";
  if (!/^\+?[\d\s.()-]{9,20}$/.test(telephone)) {
    return NextResponse.json({ error: "Numéro invalide." }, { status: 400 });
  }

  const sms = await envoyerSms({
    destinataire: "Test de configuration",
    telephone,
    message: "X Detailing : test de configuration. Si vous recevez ce message, l'envoi de SMS fonctionne.",
    motif: "MANUEL",
    envoyePar: session.email,
  });
  await journaliser({
    acteur: session,
    action: "SMS_TEST",
    entite: "Sms",
    entiteId: sms.id,
    details: { telephone: normaliserTelephone(telephone), statut: sms.statut },
  });

  return NextResponse.json({
    statut: sms.statut,
    erreur: sms.erreur,
    fournisseur: fournisseurSms(),
    numero: normaliserTelephone(telephone),
  });
}
