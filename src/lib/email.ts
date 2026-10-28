import { journaliser } from "@/lib/audit";
import { db, historiserRdv } from "@/lib/db";
import { formatParis } from "@/lib/heure";
import { titrePrestation } from "@/lib/prestationsPubliques";
import type { Devis, RendezVous } from "@/lib/types";

/**
 * E-mails transactionnels via Brevo.
 *
 * Même discipline que les SMS : envoi réel quand BREVO_API_KEY et
 * BREVO_EMAIL_SENDER sont définis, sinon rien n'est envoyé — et dans les deux
 * cas l'action est consignée au journal d'audit avec son issue. Un e-mail
 * qu'on croit parti et qui ne l'est pas coûte un devis.
 *
 * L'expéditeur doit être une adresse vérifiée dans Brevo : une adresse non
 * vérifiée fait refuser l'envoi, et la raison apparaît alors dans le journal.
 */

const NOM_EXPEDITEUR = "X Detailing";

function configuration() {
  const { BREVO_API_KEY, BREVO_EMAIL_SENDER } = process.env;
  if (!BREVO_API_KEY || !BREVO_EMAIL_SENDER) return null;
  return { cle: BREVO_API_KEY, expediteur: BREVO_EMAIL_SENDER };
}

export function emailsReelsActifs() {
  return configuration() !== null;
}

/** Adresse publique du site, pour les liens contenus dans les messages. */
export function origineSite() {
  const configuree = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!configuree) return "https://www.xdetailing.fr";
  return configuree.startsWith("http") ? configuree.replace(/\/$/, "") : `https://${configuree}`;
}

export type ResultatEmail = { envoye: boolean; erreur?: string };

export async function envoyerEmail(params: {
  destinataire: string;
  nom?: string | null;
  sujet: string;
  html: string;
  action: string;
  entite: string;
  entiteId: string;
  rendezVous?: Pick<RendezVous, "id" | "historique"> | null;
}): Promise<ResultatEmail> {
  const config = configuration();
  let envoye = false;
  let erreur: string | undefined;

  if (!config) {
    erreur = "BREVO_API_KEY ou BREVO_EMAIL_SENDER absente";
  } else {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": config.cle, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { email: config.expediteur, name: NOM_EXPEDITEUR },
          to: [{ email: params.destinataire, name: params.nom ?? undefined }],
          subject: params.sujet,
          htmlContent: params.html,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.message ?? `Brevo a répondu ${res.status}`);
      }
      envoye = true;
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    }
  }

  await journaliser({
    acteur: "systeme",
    action: envoye ? params.action : `${params.action}_ECHEC`,
    entite: params.entite,
    entiteId: params.entiteId,
    details: { destinataire: params.destinataire, sujet: params.sujet, ...(erreur ? { erreur } : {}) },
  });

  if (params.rendezVous) {
    await historiserRdv(
      params.rendezVous,
      envoye
        ? `E-mail envoyé à ${params.destinataire} : « ${params.sujet} »`
        : `E-mail NON envoyé à ${params.destinataire} (${erreur}) : « ${params.sujet} »`,
    );
  }

  return { envoye, erreur };
}

/* ── Mise en page commune ──────────────────────────────────────────────── */

const euros = (montant: number) =>
  montant.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Gabarit unique, en tableaux et styles en ligne : les clients de messagerie
 * ignorent les feuilles de style externes et une bonne part du CSS moderne.
 */
function gabarit(titre: string, corps: string, bouton?: { libelle: string; href: string }) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f4f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0c0c11">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#6425e0;font-weight:600">X Detailing</td></tr>
<tr><td style="padding-top:12px;font-size:22px;font-weight:600;line-height:1.3">${titre}</td></tr>
<tr><td style="padding-top:16px;font-size:15px;line-height:1.6;color:#44444f">${corps}</td></tr>
${
  bouton
    ? `<tr><td style="padding-top:24px"><a href="${bouton.href}" style="display:inline-block;background:#7b3cff;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px">${bouton.libelle}</a></td></tr>`
    : ""
}
<tr><td style="padding-top:28px;border-top:1px solid #e8e8ee;margin-top:24px;font-size:12px;color:#6b6b78">
X Detailing — lavage automobile à domicile, Bordeaux et alentours.
</td></tr>
</table></td></tr></table></body></html>`;
}

/* ── Les trois messages ────────────────────────────────────────────────── */

async function contexte(rdv: RendezVous) {
  const [client, adresse, pack] = await Promise.all([
    db.client.findUnique({ where: { id: rdv.clientId } }),
    db.adresse.findUnique({ where: { id: rdv.adresseId } }),
    db.pack.findUnique({ where: { id: rdv.packId } }),
  ]);
  return { client, adresse, pack };
}

const quand = (date: Date) => formatParis(date, { dateStyle: "full", timeStyle: "short" });

/** Confirmation de réservation, envoyée au client dès le rendez-vous acquis. */
export async function emailConfirmationReservation(rdv: RendezVous) {
  const { client, adresse, pack } = await contexte(rdv);
  if (!client?.email) return { envoye: false, erreur: "client sans adresse e-mail" };

  const prestation = pack ? titrePrestation(pack.id, pack.nom) : "votre prestation";
  const corps = `
    <p>Bonjour ${client.prenom},</p>
    <p>Votre rendez-vous est enregistré.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Prestation</td><td><strong>${prestation}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Date</td><td><strong>${quand(rdv.dateHeure)}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Adresse</td><td>${adresse?.adresse ?? ""}, ${adresse?.ville ?? ""}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Total</td><td>${euros(rdv.prixTotal)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Acompte</td><td>${euros(rdv.acompte)}</td></tr>
    </table>
    <p style="margin-top:20px">Le jour venu, vous pourrez suivre l'arrivée de votre opérateur depuis le lien ci-dessous.</p>`;

  return envoyerEmail({
    destinataire: client.email,
    nom: `${client.prenom} ${client.nom}`,
    sujet: `Votre rendez-vous X Detailing — ${quand(rdv.dateHeure)}`,
    html: gabarit("Rendez-vous confirmé", corps, {
      libelle: "Suivre ma prestation",
      href: `${origineSite()}/suivi/${rdv.suiviToken}`,
    }),
    action: "EMAIL_CONFIRMATION_RDV",
    entite: "RendezVous",
    entiteId: rdv.id,
    rendezVous: rdv,
  });
}

/** Devis envoyé au prospect, avec son lien d'acceptation. */
export async function emailDevis(devis: Devis) {
  if (!devis.emailClient) return { envoye: false, erreur: "devis sans adresse e-mail" };

  const corps = `
    <p>Bonjour ${devis.nomClient},</p>
    <p>Voici votre devis pour le nettoyage de votre véhicule.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Véhicule</td><td>${devis.vehiculeDescription}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Lieu</td><td>${devis.adresse}, ${devis.ville}</td></tr>
      ${
        Number(devis.remisePourcent) > 0
          ? `<tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Remise</td><td>${devis.remisePourcent} %</td></tr>`
          : ""
      }
      ${
        Number(devis.fraisDeplacement) > 0
          ? `<tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Déplacement</td><td>${euros(Number(devis.fraisDeplacement))}</td></tr>`
          : ""
      }
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Total</td><td><strong>${euros(devis.prixTotal)}</strong></td></tr>
      ${
        devis.avecAcompte
          ? `<tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Acompte à la réservation</td><td>${euros(devis.acompte)}</td></tr>`
          : ""
      }
    </table>
    <p style="margin-top:20px">Le détail des prestations et des options se trouve sur la page du devis.</p>`;

  return envoyerEmail({
    destinataire: devis.emailClient,
    nom: devis.nomClient,
    sujet: `Votre devis X Detailing — ${euros(devis.prixTotal)}`,
    html: gabarit("Votre devis", corps, {
      libelle: "Voir et accepter le devis",
      href: `${origineSite()}/devis/${devis.token}`,
    }),
    action: "EMAIL_DEVIS",
    entite: "Devis",
    entiteId: devis.id,
  });
}

/** Facture, envoyée à la clôture du dossier. */
export async function emailFacture(rdv: RendezVous) {
  const { client, adresse, pack } = await contexte(rdv);
  if (!client?.email) return { envoye: false, erreur: "client sans adresse e-mail" };

  const prestation = pack ? titrePrestation(pack.id, pack.nom) : "votre prestation";
  const corps = `
    <p>Bonjour ${client.prenom},</p>
    <p>Votre prestation est terminée. Voici votre facture.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Facture</td><td><strong>${rdv.numeroFacture ?? ""}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Prestation</td><td>${prestation}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Date</td><td>${quand(rdv.dateHeure)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Lieu</td><td>${adresse?.adresse ?? ""}, ${adresse?.ville ?? ""}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Total réglé</td><td><strong>${euros(rdv.prixTotal)}</strong></td></tr>
    </table>
    <p style="margin-top:20px">Les photos avant et après votre prestation restent consultables depuis votre page de suivi.</p>`;

  return envoyerEmail({
    destinataire: client.email,
    nom: `${client.prenom} ${client.nom}`,
    sujet: `Facture ${rdv.numeroFacture ?? ""} — X Detailing`,
    html: gabarit("Votre facture", corps, {
      libelle: "Voir les photos et noter la prestation",
      href: `${origineSite()}/suivi/${rdv.suiviToken}`,
    }),
    action: "EMAIL_FACTURE",
    entite: "RendezVous",
    entiteId: rdv.id,
    rendezVous: rdv,
  });
}
