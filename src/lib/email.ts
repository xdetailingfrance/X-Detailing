import { journaliser } from "@/lib/audit";
import { db, historiserRdv } from "@/lib/db";
import { dureeLisible, formatParis } from "@/lib/heure";
import { titrePrestation } from "@/lib/prestationsPubliques";
import { factureParId } from "@/lib/facturation";
import { genererFacturePdf, nomFichierFacture } from "@/lib/facturePdf";
import { factureDemo } from "@/lib/factureDemo";
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
  const cle = process.env.BREVO_API_KEY?.trim();
  const expediteur = process.env.BREVO_EMAIL_SENDER?.trim();
  if (!cle || !expediteur) return null;
  return { cle, expediteur };
}

/**
 * Ce qui manque exactement, ou null si tout est là.
 *
 * Un message qui dit « BREVO_API_KEY ou BREVO_EMAIL_SENDER absente » oblige
 * à chercher laquelle des deux — et à soupçonner la mauvaise quand les SMS,
 * eux, fonctionnent avec la même clé. On nomme la variable fautive, et on
 * distingue l'absente de la vide : une variable présente mais vide
 * ressemble, dans l'interface de Vercel, à une variable correctement
 * renseignée. Aucune valeur n'est divulguée.
 */
export function diagnosticEmail(): string | null {
  const manquantes: string[] = [];
  for (const nom of ["BREVO_API_KEY", "BREVO_EMAIL_SENDER"] as const) {
    const brute = process.env[nom];
    if (brute === undefined) manquantes.push(`${nom} n'est pas définie`);
    else if (brute.trim() === "") manquantes.push(`${nom} est définie mais vide`);
  }
  return manquantes.length > 0 ? manquantes.join(" ; ") : null;
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
  /** Fichiers joints, encodés par Brevo depuis leur contenu binaire. */
  pieces?: { nom: string; contenu: Uint8Array }[];
}): Promise<ResultatEmail> {
  const config = configuration();
  let envoye = false;
  let erreur: string | undefined;

  if (!config) {
    erreur = diagnosticEmail() ?? "configuration d'envoi incomplète";
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
          ...(params.pieces?.length
            ? {
                attachment: params.pieces.map((p) => ({
                  name: p.nom,
                  content: Buffer.from(p.contenu).toString("base64"),
                })),
              }
            : {}),
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

// Le déplacement est compris dans le total : il apparaît en ligne séparée
// pour que le client reconnaisse le montant qu'on lui a annoncé, au lieu de
// chercher d'où sort la différence.
const ligneDeplacement = (rdv: Pick<RendezVous, "fraisDeplacement" | "distanceKm">) =>
  Number(rdv.fraisDeplacement) > 0
    ? `<tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Dont déplacement</td><td>${euros(Number(rdv.fraisDeplacement))}${
        rdv.distanceKm != null ? ` (${Math.round(rdv.distanceKm)} km)` : ""
      }</td></tr>`
    : "";

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
  const [client, adresse, pack, operateur] = await Promise.all([
    db.client.findUnique({ where: { id: rdv.clientId } }),
    db.adresse.findUnique({ where: { id: rdv.adresseId } }),
    db.pack.findUnique({ where: { id: rdv.packId } }),
    rdv.operateurId ? db.operateur.findUnique({ where: { id: rdv.operateurId } }) : Promise.resolve(null),
  ]);
  return { client, adresse, pack, operateur };
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
      ${ligneDeplacement(rdv)}
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

  // Le PDF est joint au message : le client garde sa facture sans avoir à
  // cliquer. Si sa génération échoue, l'e-mail part quand même avec le lien
  // — une facture consultable vaut mieux qu'un message jamais envoyé.
  let piece: { nom: string; contenu: Uint8Array } | null = null;
  const complete = await factureParId(rdv.id);
  if (complete) {
    try {
      piece = { nom: nomFichierFacture(complete), contenu: await genererFacturePdf(complete) };
    } catch (e) {
      console.error("Génération du PDF de facture impossible", e);
    }
  }

  const prestation = pack ? titrePrestation(pack.id, pack.nom) : "votre prestation";
  const corps = `
    <p>Bonjour ${client.prenom},</p>
    <p>Votre prestation est terminée. Votre facture est jointe à ce message.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Facture</td><td><strong>${rdv.numeroFacture ?? ""}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Prestation</td><td>${prestation}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Date</td><td>${quand(rdv.dateHeure)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Lieu</td><td>${adresse?.adresse ?? ""}, ${adresse?.ville ?? ""}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Total réglé</td><td><strong>${euros(rdv.prixTotal)}</strong></td></tr>
      ${ligneDeplacement(rdv)}
    </table>
    <p style="margin-top:20px">
      Elle reste également consultable en ligne depuis le bouton ci-dessous, avec les photos avant et après la
      prestation.
    </p>
    <p style="margin-top:16px">
      Votre avis nous aide à progresser :
      <a href="${origineSite()}/suivi/${rdv.suiviToken}#avis" style="color:#6d3cf5">noter la prestation en un clic</a>.
    </p>`;

  return envoyerEmail({
    destinataire: client.email,
    nom: `${client.prenom} ${client.nom}`,
    sujet: `Facture ${rdv.numeroFacture ?? ""} — X Detailing`,
    html: gabarit("Votre facture", corps, {
      libelle: "Voir et télécharger ma facture",
      href: `${origineSite()}/suivi/${rdv.suiviToken}/facture`,
    }),
    action: "EMAIL_FACTURE",
    entite: "RendezVous",
    entiteId: rdv.id,
    rendezVous: rdv,
    pieces: piece ? [piece] : undefined,
  });
}

/** Rendez-vous décalé : le client est prévenu de l'ancienne et de la nouvelle date. */
export async function emailRendezVousDecale(rdv: RendezVous, ancienneDate: Date) {
  const { client, adresse, pack } = await contexte(rdv);
  if (!client?.email) return { envoye: false, erreur: "client sans adresse e-mail" };

  const prestation = pack ? titrePrestation(pack.id, pack.nom) : "votre prestation";
  const corps = `
    <p>Bonjour ${client.prenom},</p>
    <p>Votre rendez-vous a été déplacé.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Prestation</td><td>${prestation}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Ancienne date</td><td style="text-decoration:line-through;color:#6b6b78">${quand(ancienneDate)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Nouvelle date</td><td><strong>${quand(rdv.dateHeure)}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Adresse</td><td>${adresse?.adresse ?? ""}, ${adresse?.ville ?? ""}</td></tr>
    </table>
    <p style="margin-top:20px">Si cette nouvelle date ne vous convient pas, répondez à ce message ou appelez-nous.</p>`;

  return envoyerEmail({
    destinataire: client.email,
    nom: `${client.prenom} ${client.nom}`,
    sujet: `Votre rendez-vous est déplacé au ${quand(rdv.dateHeure)}`,
    html: gabarit("Rendez-vous déplacé", corps, {
      libelle: "Voir mon rendez-vous",
      href: `${origineSite()}/suivi/${rdv.suiviToken}`,
    }),
    action: "EMAIL_RDV_DECALE",
    entite: "RendezVous",
    entiteId: rdv.id,
    rendezVous: rdv,
  });
}

/** Rendez-vous annulé. */
export async function emailRendezVousAnnule(rdv: RendezVous, motif?: string | null) {
  const { client, pack } = await contexte(rdv);
  if (!client?.email) return { envoye: false, erreur: "client sans adresse e-mail" };

  const prestation = pack ? titrePrestation(pack.id, pack.nom) : "votre prestation";
  const corps = `
    <p>Bonjour ${client.prenom},</p>
    <p>Votre rendez-vous ${prestation} du ${quand(rdv.dateHeure)} a été annulé.</p>
    ${motif ? `<p>Motif : ${motif}</p>` : ""}
    <p>Si vous souhaitez reprendre un créneau, notre site reste à votre disposition — ou appelez-nous, nous trouverons une date.</p>`;

  return envoyerEmail({
    destinataire: client.email,
    nom: `${client.prenom} ${client.nom}`,
    sujet: `Annulation de votre rendez-vous du ${quand(rdv.dateHeure)}`,
    html: gabarit("Rendez-vous annulé", corps, {
      libelle: "Reprendre un créneau",
      href: origineSite(),
    }),
    action: "EMAIL_RDV_ANNULE",
    entite: "RendezVous",
    entiteId: rdv.id,
    rendezVous: rdv,
  });
}

/**
 * Mission envoyée à l'opérateur dès qu'un rendez-vous lui revient.
 *
 * Le SMS tient en 160 caractères : il annonce. L'e-mail porte ce qu'il faut
 * pour s'organiser — adresse complète, téléphone du client, véhicule,
 * durée, options — et le lien vers son espace.
 */
export async function emailAffectationOperateur(rdv: RendezVous) {
  const { client, adresse, pack, operateur } = await contexte(rdv);
  if (!operateur?.email) return { envoye: false, erreur: "opérateur sans adresse e-mail" };

  const prestation = pack ? titrePrestation(pack.id, pack.nom) : "une prestation";
  const corps = `
    <p>Bonjour ${operateur.prenom},</p>
    <p>Un nouveau rendez-vous vous est attribué.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Quand</td><td><strong>${quand(rdv.dateHeure)}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Prestation</td><td>${prestation} · ${dureeLisible(rdv.dureeMinutes)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Client</td><td>${client?.prenom ?? ""} ${client?.nom ?? ""} · ${client?.telephone ?? ""}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Adresse</td><td>${adresse?.adresse ?? ""}${adresse?.codePostal ? `, ${adresse.codePostal}` : ""} ${adresse?.ville ?? ""}</td></tr>
      ${rdv.notes ? `<tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Précisions</td><td>${rdv.notes}</td></tr>` : ""}
    </table>
    <p style="margin-top:20px">Le détail, les photos et le déroulé de la prestation sont dans votre espace opérateur.</p>`;

  return envoyerEmail({
    destinataire: operateur.email,
    nom: `${operateur.prenom} ${operateur.nom}`,
    sujet: `Nouveau rendez-vous — ${quand(rdv.dateHeure)}`,
    html: gabarit("Votre prochaine intervention", corps, {
      libelle: "Ouvrir mon espace",
      href: `${origineSite()}/operateur/rendez-vous/${rdv.id}`,
    }),
    action: "EMAIL_AFFECTATION_OPERATEUR",
    entite: "RendezVous",
    entiteId: rdv.id,
    rendezVous: rdv,
  });
}

/**
 * Envoi de contrôle : la facture type, à l'adresse de son choix.
 *
 * Reprend exactement le chemin réel — même gabarit, même génération de PDF,
 * même lien d'avis — sur une facture fictive. Sans cela, il faudrait
 * clôturer une vraie prestation pour vérifier que la chaîne fonctionne.
 */
export async function emailFactureTest(destinataire: string) {
  const facture = factureDemo();
  let piece: { nom: string; contenu: Uint8Array } | null = null;
  let erreurPdf: string | null = null;
  try {
    piece = { nom: nomFichierFacture(facture), contenu: await genererFacturePdf(facture) };
  } catch (e) {
    erreurPdf = e instanceof Error ? e.message : String(e);
  }

  const lienSuivi = `${origineSite()}/suivi/${facture.suiviToken}`;
  const corps = `
    <p>Bonjour,</p>
    <p>Ceci est un <strong>envoi de contrôle</strong> de X Detailing. Il reprend exactement la facture
    envoyée à vos clients à la fin d'une prestation, sur un dossier fictif.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:15px">
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Facture</td><td><strong>${facture.numeroFacture}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Prestation</td><td>Lavage intérieur + extérieur</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Date</td><td>${quand(facture.dateHeure)}</td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Total réglé</td><td><strong>${euros(facture.prixTotal)}</strong></td></tr>
      <tr><td style="padding:4px 16px 4px 0;color:#6b6b78">Dont déplacement</td><td>${euros(facture.fraisDeplacement)} (19 km)</td></tr>
    </table>
    <p style="margin-top:20px">
      ${piece ? "La facture en PDF est jointe à ce message." : `<strong>Le PDF n'a pas pu être produit (${erreurPdf}).</strong>`}
    </p>
    <p style="margin-top:16px">
      Le lien d'avis d'un vrai client ressemble à celui-ci :
      <a href="${lienSuivi}#avis" style="color:#6d3cf5">noter la prestation en un clic</a>.
      Sur cet envoi de contrôle il mène à une page introuvable, puisque le dossier n'existe pas.
    </p>`;

  return envoyerEmail({
    destinataire,
    nom: "Envoi de contrôle",
    sujet: "Test X Detailing — facture et lien d'avis",
    html: gabarit("Envoi de contrôle", corps, { libelle: "Ouvrir le site", href: origineSite() }),
    action: "EMAIL_TEST",
    entite: "Systeme",
    entiteId: "test",
    pieces: piece ? [piece] : undefined,
  });
}
