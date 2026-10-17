"use server";

import { z } from "zod";
import { BUSINESS, realValue } from "@/lib/business";
import {
  FORMULE_IDS,
  OPTION_IDS,
  VEHICULE_IDS,
  euros,
  formule,
  option,
  prixFormule,
  totalDevis,
  vehicule,
} from "@/lib/catalogue";
import {
  CRENEAUX,
  creneauPropose,
  joursProposes,
  libelleCreneau,
  libelleHeure,
  libelleJour,
  type Creneau,
} from "@/lib/creneaux";
import { cleCreneau as cle, depot } from "@/lib/db";
import { notifyBusiness } from "@/lib/web3forms";

/**
 * Réservation d'un créneau.
 *
 * La validation vit ici, côté serveur : celle du navigateur améliore le confort,
 * elle ne protège de rien. Le total est recalculé à partir du catalogue — ce que le
 * navigateur annonce n'est jamais repris. Le créneau est écrit en base avant que
 * l'e-mail parte : s'il vient d'être pris par quelqu'un d'autre, l'écriture échoue
 * et le visiteur en choisit un autre. Si l'e-mail ne part pas, la réservation est
 * effacée : un créneau bloqué dont personne n'est prévenu est un créneau perdu.
 */

/** Numéro français, avec ou sans indicatif, espaces et points tolérés. */
const PHONE = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

const schema = z.object({
  formule: z.enum(FORMULE_IDS, { error: "Choisissez une formule." }),
  vehicule: z.enum(VEHICULE_IDS, { error: "Choisissez votre véhicule." }),
  options: z.array(z.enum(OPTION_IDS)).max(OPTION_IDS.length).default([]),
  adresse: z
    .string()
    .trim()
    .min(3, "Indiquez votre rue et votre numéro.")
    .max(200, "Adresse trop longue."),
  codePostal: z.string().trim().regex(/^\d{5}$/, "Code postal à cinq chiffres."),
  ville: z.string().trim().min(2, "Indiquez votre ville.").max(100, "Ville trop longue."),
  jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez un jour."),
  creneau: z.enum(CRENEAUX, { error: "Choisissez un créneau." }),
  precisions: z.string().trim().max(1000, "Précisions trop longues.").default(""),
  prenom: z.string().trim().min(2, "Indiquez votre prénom."),
  nom: z.string().trim().min(2, "Indiquez votre nom."),
  telephone: z
    .string()
    .trim()
    .regex(PHONE, "Numéro de téléphone français attendu, par exemple 06 12 34 56 78."),
  email: z.email({ error: "Adresse e-mail invalide." }),
  message: z.string().trim().max(2000, "Message trop long.").default(""),
  consent: z.literal("on", {
    error: "Votre accord est nécessaire pour traiter la demande.",
  }),
});

export type ReservationState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string>; message?: string }
  | {
      status: "sent";
      resume: { creneau: string; formule: string; vehicule: string; total: number } | null;
    };

/** Les créneaux encore libres, tels que le formulaire les affiche. */
export type Disponibilites =
  | {
      jours: Array<{
        jour: string;
        libelle: string;
        court: string;
        creneaux: Array<{ heure: Creneau; libelle: string; disponible: boolean }>;
      }>;
    }
  | { erreur: string };

function indisponible(): string {
  const phone = realValue(BUSINESS.phone);
  return phone
    ? `La réservation en ligne est indisponible pour le moment. Réessayez dans un instant, ou appelez-nous au ${phone}.`
    : "La réservation en ligne est indisponible pour le moment. Réessayez dans un instant.";
}

export async function chargerCreneaux(): Promise<Disponibilites> {
  const jours = joursProposes();
  if (jours.length === 0) return { erreur: "Aucun créneau n'est ouvert à la réservation." };

  try {
    const pris = await depot().creneauxPris(jours[0].jour, jours[jours.length - 1].jour);
    return {
      jours: jours.map((j) => ({
        jour: j.jour,
        libelle: j.libelle,
        court: j.court,
        creneaux: j.creneaux.map((heure) => ({
          heure,
          libelle: libelleHeure(heure),
          disponible: !pris.has(cle(j.jour, heure)),
        })),
      })),
    };
  } catch (error) {
    console.error("[reservations] lecture impossible :", error);
    return { erreur: indisponible() };
  }
}

export async function reserver(
  _previous: ReservationState,
  formData: FormData,
): Promise<ReservationState> {
  // Piège à robots : un champ invisible qu'un humain ne remplit jamais. On répond
  // « envoyé » sans rien faire, pour ne pas renseigner l'automate sur sa détection.
  if (String(formData.get("website") ?? "") !== "") return { status: "sent", resume: null };

  const parsed = schema.safeParse({
    ...Object.fromEntries(formData.entries()),
    options: formData.getAll("options").map(String),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
    }
    return { status: "error", errors, message: "Vérifiez les champs signalés." };
  }

  const d = parsed.data;

  // Le jour et l'heure doivent faire partie de ce que l'on propose à cet instant :
  // un créneau passé, un dimanche ou une date lointaine ne s'acceptent pas, même
  // envoyés à la main.
  if (!creneauPropose(d.jour, d.creneau)) {
    return {
      status: "error",
      errors: { creneau: "Ce créneau n'est plus proposé. Choisissez-en un autre." },
      message: "Ce créneau n'est plus proposé.",
    };
  }

  const f = formule(d.formule);
  const v = vehicule(d.vehicule);
  const options = d.options.map((id) => option(id));
  const total = totalDevis(d.formule, d.vehicule, d.options);
  const email = d.email.toLowerCase();

  let base;
  let enregistrement;
  try {
    base = depot();
    enregistrement = await base.enregistrer({
      jour: d.jour,
      creneau: d.creneau,
      formule: d.formule,
      vehicule: d.vehicule,
      options: d.options,
      totalEuros: total,
      adresse: d.adresse,
      codePostal: d.codePostal,
      ville: d.ville,
      precisions: d.precisions || null,
      prenom: d.prenom,
      nom: d.nom,
      telephone: d.telephone,
      email,
      message: d.message || null,
    });
  } catch (error) {
    console.error("[reservations] écriture impossible :", error);
    return { status: "error", errors: {}, message: indisponible() };
  }

  if (!enregistrement.ok) {
    return {
      status: "error",
      errors: { creneau: "Ce créneau vient d'être réservé. Choisissez-en un autre." },
      message: "Ce créneau vient d'être réservé par quelqu'un d'autre.",
    };
  }

  const creneau = libelleCreneau(d.jour, d.creneau);

  const notice = await notifyBusiness({
    subject: `Réservation — ${libelleJour(d.jour, "court")} ${libelleHeure(d.creneau)} · ${f.court} · ${v.label} · ${euros(total)} — ${d.prenom} ${d.nom}`,
    replyTo: email,
    lines: [
      ["Créneau", creneau],
      ["Formule", `${f.nom} (${euros(prixFormule(d.formule, d.vehicule))})`],
      ["Véhicule", v.label],
      [
        "Options",
        options.length > 0
          ? options.map((o) => `${o.nom} (+${euros(o.prix)})`).join(", ")
          : "aucune",
      ],
      ["Total estimé", `${euros(total)} TTC`],
      ["Adresse", `${d.adresse}, ${d.codePostal} ${d.ville}`],
      ["Précisions", d.precisions || null],
      ["Nom", `${d.prenom} ${d.nom}`],
      ["Téléphone", d.telephone],
      ["E-mail", email],
      ["Message", d.message || null],
      ["Référence", enregistrement.id],
    ],
  });

  if (!notice.sent) {
    console.warn(`[reservations] e-mail non transmis : ${notice.reason}`);
    await base.supprimer(enregistrement.id).catch((error) => {
      console.error("[reservations] créneau non libéré :", error);
    });
    const phone = realValue(BUSINESS.phone);
    return {
      status: "error",
      errors: {},
      message: phone
        ? `L'envoi n'a pas abouti et le créneau n'a pas été réservé. Réessayez dans un instant, ou appelez-nous au ${phone}.`
        : "L'envoi n'a pas abouti et le créneau n'a pas été réservé. Réessayez dans un instant.",
    };
  }

  return { status: "sent", resume: { creneau, formule: f.nom, vehicule: v.label, total } };
}
