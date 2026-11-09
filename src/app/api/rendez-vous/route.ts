import { NextResponse } from "next/server";
import { listerRendezVousAvecRelations, rendezVousAvecRelations } from "@/lib/queries";
import { creerRendezVous } from "@/lib/rendezVous";
import { MODELES_SMS, smsAuClient } from "@/lib/sms";
import { getSession } from "@/lib/session";
import { dateParis, decalerJour, lireDateSaisie } from "@/lib/heure";
import { journaliser } from "@/lib/audit";
import type { SourceRendezVous } from "@/lib/types";
import { attribuerAutomatiquement } from "@/lib/attribution";
import { emailConfirmationReservation } from "@/lib/email";

const SOURCES: SourceRendezVous[] = ["SITE_CLIENT", "TELEPHONE", "LEAD_META", "LAVER_MAINTENANT", "DEVIS"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD, journée à Paris
  const operateurId = searchParams.get("operateurId");
  const plage = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { gte: dateParis(date), lt: dateParis(decalerJour(date, 1)) } : undefined;
  return NextResponse.json(await listerRendezVousAvecRelations({ dateHeure: plage, operateurId: operateurId ?? undefined }));
}

// Création manuelle d'un rendez-vous (appel téléphonique...). Prix et
// acompte recalculés côté serveur ; le RDV est créé sans opérateur
// (EN_ATTENTE), l'affectation se fait ensuite. Le client reçoit un SMS de
// confirmation automatique.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await request.json().catch(() => null);
  for (const champ of ["clientId", "vehiculeId", "adresseId", "packId", "dateHeure"]) {
    if (!body?.[champ]) {
      return NextResponse.json({ error: `${champ} requis` }, { status: 400 });
    }
  }
  const duree = body.dureeMinutes == null || body.dureeMinutes === "" ? null : Number(body.dureeMinutes);
  if (duree != null && (!Number.isInteger(duree) || duree <= 0)) return NextResponse.json({ error: "durée invalide" }, { status: 400 });

  // Acompte : absent = 10 % comme d'habitude, 0 = aucun. Le montant est
  // vérifié ici plutôt que cru sur parole.
  const acompte = body.acompte == null || body.acompte === "" ? null : Number(body.acompte);
  if (acompte != null && (!Number.isFinite(acompte) || acompte < 0)) {
    return NextResponse.json({ error: "acompte invalide" }, { status: 400 });
  }

  const remisePourcent = body.remisePourcent == null || body.remisePourcent === "" ? 0 : Number(body.remisePourcent);
  if (!Number.isFinite(remisePourcent) || remisePourcent < 0 || remisePourcent > 100) {
    return NextResponse.json({ error: "remise invalide (0 à 100 %)" }, { status: 400 });
  }

  const resultat = await creerRendezVous({
    clientId: body.clientId,
    vehiculeId: body.vehiculeId,
    adresseId: body.adresseId,
    packId: body.packId,
    dateHeure: lireDateSaisie(body.dateHeure),
    optionIds: Array.isArray(body.optionIds) ? body.optionIds.filter((id: unknown) => typeof id === "string") :[],
      secteurId: body.secteurId || null,
      acompte,
      remisePourcent,
      dureeMinutes: duree,
      source: SOURCES.includes(body.source) ? body.source : "TELEPHONE",
      notes: body.notes || null,
    });
    if (!resultat.ok) {
      return NextResponse.json({ error: resultat.erreur }, { status: 400 });
    }

    const rdv = resultat.valeur;
    await journaliser({ acteur: session, action: "RDV_CREE", entite: "RendezVous", entiteId: rdv.id });
    await smsAuClient(rdv, await MODELES_SMS.confirmationClient(rdv), "CONFIRMATION_RDV", session.email);
    // L'e-mail double le SMS, comme pour la réservation en ligne : il porte
    // l'adresse, le détail du prix et le lien de suivi, qu'un message de 160
    // caractères ne peut pas contenir. Son absence ici était un oubli : le
    // client appelé au téléphone ne recevait aucune trace écrite.
    await emailConfirmationReservation(rdv);
    // Même règle qu'en ligne : l'opérateur qui couvre la zone le reçoit
    // directement, sans étape de validation.
    await attribuerAutomatiquement(rdv).catch((e) => console.error("Attribution automatique impossible", e));

    return NextResponse.json(await rendezVousAvecRelations(rdv.id), { status: 201 });
}

