// Envoi de SMS (confirmations, affectations, rappels, messages libres).
//
// Deux fournisseurs possibles, choisis selon les variables présentes :
// Brevo (BREVO_API_KEY + BREVO_SMS_SENDER) ou Twilio (TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN, TWILIO_FROM). Aucun des deux : le SMS est SIMULÉ.
//
// Dans tous les cas il est consigné dans le journal (table Sms, page
// /back-office/sms) et dans l'historique du RDV — y compris un échec, avec
// sa raison. Un SMS qu'on croit parti et qui ne l'est pas coûte un
// rendez-vous.
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

function configurationBrevo() {
  const { BREVO_API_KEY, BREVO_SMS_SENDER } = process.env;
  if (!BREVO_API_KEY || !BREVO_SMS_SENDER) return null;
  return { cle: BREVO_API_KEY, expediteur: BREVO_SMS_SENDER };
}

/** Le fournisseur retenu, ou null si les SMS sont simulés. */
export function fournisseurSms(): "brevo" | "twilio" | null {
  if (configurationBrevo()) return "brevo";
  if (configurationTwilio()) return "twilio";
  return null;
}

export function smsReelsActives() {
  return fournisseurSms() !== null;
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

/**
 * Brevo — SMS transactionnel.
 *
 * L'expéditeur est alphanumérique (« XDetailing »), limité à 11 caractères
 * en France, et le destinataire attendu sans le « + » de l'E.164.
 */
async function envoyerViaBrevo(telephone: string, message: string) {
  const config = configurationBrevo()!;
  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": config.cle,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      type: "transactional",
      sender: config.expediteur.slice(0, 11),
      recipient: normaliserTelephone(telephone).replace(/^\+/, ""),
      content: message,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.message ?? `Brevo a répondu ${res.status}`);
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
      if (fournisseurSms() === "brevo") await envoyerViaBrevo(params.telephone, params.message);
      else await envoyerViaTwilio(params.telephone, params.message);
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

