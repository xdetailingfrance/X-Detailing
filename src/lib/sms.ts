// Envoi de SMS (confirmations, affectations, rappels, messages libres).
//
// Envoi réel via l'API Twilio quand TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// et TWILIO_FROM sont définis ; sinon le SMS est SIMULÉ (même comportement
// que le reste du mode démo). Dans tous les cas il est consigné dans le
// journal (table Sms, page /back-office/sms) et dans l'historique du RDV.
import type { MotifSms, RendezVous, Sms, StatutSms } from "@/lib/types";
import { db, historiserRdv, versRdv } from "@/lib/db";
import { titrePrestation } from "@/lib/prestationsPubliques";
import { decalerJour, dateParis, jourParis, formatParis } from "@/lib/heure";

const SIGNATURE = "X Detailing";

function configurationTwilio() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) return null;
  return { sid: TWILIO_ACCOUNT_SID, jeton: TWILIO_AUTH_TOKEN, expediteur: TWILIO_FROM };
}

export function smsReelsActives() {
  return configurationTwilio() !== null;
}

// Numéro français saisi « 06 12 34 56 78 » → format international E.164.
export function normaliserTelephone(telephone: string) {
  const chiffres = telephone.replace(/[^\d+]/g, "");
  if (chiffres.startsWith("+")) return chiffres;
  if (chiffres.startsWith("00")) return `+${chiffres.slice(2)}`;
  if (chiffres.startsWith("0") && chiffres.length === 10) return `+33${chiffres.slice(1)}`;
    return chiffres;
}

async function envoyerViaTwilio(telephone: string, message: string) {
  const config = configurationTwilio()!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.sid}:${config.jeton}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: normaliserTelephone(telephone), From: config.expediteur, Body: message }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.message ?? `Twilio a répondu ${res.status}`);
  }
}

export async function envoyerSms(params: {
  destinataire: string;
  telephone: string;
  message: string;
  motif: MotifSms;
  rendezVous?: Pick<RendezVous, "id" | "historique"> | null;
  envoyePar: string;
}): Promise<Sms> {
  let statut: StatutSms = "SIMULE";
  let erreur: string | null = null;
  if (smsReelsActives()) {
    try {
      await envoyerViaTwilio(params.telephone, params.message);
      statut = "ENVOYE";
    } catch (e) {
      statut = "ECHEC";
      erreur = e instanceof Error ? e.message : String(e);
    }
  }

    const sms = await db.sms.create({
      data: {
        destinataire: params.destinataire,
        telephone: params.telephone,
        message: params.message,
        motif: params.motif,
        statut,
        erreur,
        rendezVousId: params.rendezVous?.id ?? null,
        envoyePar: params.envoyePar,
      },
    });
    if (params.rendezVous) {
      const etat = statut === "ENVOYE" ? "envoyé" : statut === "SIMULE" ? "envoyé (simulé)" : "en échec";
      await historiserRdv(params.rendezVous, `SMS ${etat} à ${params.destinataire} : « ${params.message} »`);
    }
    return sms;
}

// ---------------------------------------------------------------------------
// Modèles de messages automatiques
// ---------------------------------------------------------------------------

function quand(date: Date) {
  const jour = formatParis(date, { weekday: "long", day: "numeric", month: "long" });
  const heure = formatParis(date, { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `${jour} à ${heure}`;
}

async function contexteRdv(rdv: RendezVous) {
  const [client, adresse, pack, operateur] = await Promise.all([
    db.client.findUnique({ where: { id: rdv.clientId } }),
    db.adresse.findUnique({ where: { id: rdv.adresseId } }),
    db.pack.findUnique({ where: { id: rdv.packId } }),
    rdv.operateurId ? db.operateur.findUnique({ where: { id: rdv.operateurId } }) : null,
  ]);
  return { client, adresse, pack, operateur };
}

export const MODELES_SMS = {
  async confirmationClient(rdv: RendezVous) {
    const { client, pack } = await contexteRdv(rdv);
    const prestation = pack ? titrePrestation(pack.id, pack.nom) : "";
    return `Bonjour ${client?.prenom ?? ""}, votre rendez-vous ${prestation} est enregistré pour ${quand(rdv.dateHeure)}. Acompte : ${rdv.acompte.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}. À bientôt !${SIGNATURE}`;
  },
  async affectationClient(rdv: RendezVous) {
    const { client, operateur } = await contexteRdv(rdv);
    return `Bonjour ${client?.prenom ?? ""}, ${operateur?.prenom ?? "notre opérateur"} interviendra pour votre lavage ${quand(rdv.dateHeure)}. ${SIGNATURE}`;
  },
  async affectationOperateur(rdv: RendezVous) {
    const { client, adresse, pack } = await contexteRdv(rdv);
    return `Nouveau RDV ${quand(rdv.dateHeure)} : ${pack?.nom ?? ""} pour ${client?.prenom ?? ""} ${client?.nom?? ""} (${client?.telephone ?? ""}), ${adresse?.adresse ?? ""} ${adresse?.ville ?? ""}. ${SIGNATURE}`;
  },
  async modificationClient(rdv: RendezVous) {
    const { client } = await contexteRdv(rdv);
    return `Bonjour ${client?.prenom ?? ""}, votre rendez-vous est déplacé au ${quand(rdv.dateHeure)}. ${SIGNATURE}`;
  },
  async annulationClient(rdv: RendezVous) {
    const { client } = await contexteRdv(rdv);
    return `Bonjour ${client?.prenom ?? ""}, votre rendez-vous du ${quand(rdv.dateHeure)} est annulé. Contactez-nous pour le reprogrammer. ${SIGNATURE}`;
  },
  async rappelVeille(rdv: RendezVous) {
    const { client, adresse } = await contexteRdv(rdv);
    return `Rappel : ${client?.prenom ?? ""}, nous venons laver votre véhicule ${quand(rdv.dateHeure)} au ${adresse?.adresse ?? ""}. Pensez à laisser l'accès libre. ${SIGNATURE}`;
  },
};

export async function smsAuClient(rdv: RendezVous, message: string, motif: MotifSms, envoyePar: string) {
  const { client } = await contexteRdv(rdv);
  if (!client) return null;
  return envoyerSms({
    destinataire: `${client.prenom} ${client.nom}`,
    telephone: client.telephone,
    message,
    motif,
    rendezVous: rdv,
    envoyePar,
  });
}

export async function smsAOperateur(rdv: RendezVous, message: string, motif: MotifSms, envoyePar: string) {
  const { operateur } = await contexteRdv(rdv);
  if (!operateur) return null;
  return envoyerSms({
    destinataire: `${operateur.prenom} ${operateur.nom}`,
    telephone: operateur.telephone,
    message,
    motif,
    rendezVous: rdv,
    envoyePar,
  });
}

// Rappels de la veille : un SMS à chaque client ayant un RDV (non annulé)
// le jour donné et n'ayant pas déjà reçu de rappel pour ce RDV.
// jour = « YYYY-MM-DD » (journée à Paris).
export async function envoyerRappels(jour: string, envoyePar: string) {
  const lignes = await db.rendezVous.findMany({
    where: {
      dateHeure: { gte: dateParis(jour), lt: dateParis(decalerJour(jour, 1)) },
      statut: { notIn: ["ANNULE", "TERMINE"] },
      sms: { none: { motif: "RAPPEL_VEILLE" } },
    },
  });
  const envoyes: Sms[] = [];
  for (const rdv of lignes.map(versRdv)) {
    const sms = await smsAuClient(rdv, await MODELES_SMS.rappelVeille(rdv), "RAPPEL_VEILLE", envoyePar);
    if (sms) envoyes.push(sms);
  }
  return envoyes;
}

// Demain à Paris, « YYYY-MM-DD ».
export function demainParis() {
  return decalerJour(jourParis(new Date()), 1);
}

