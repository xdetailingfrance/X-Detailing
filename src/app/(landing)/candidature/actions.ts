"use server";

import { z } from "zod";
import { prisma } from "@/server/db";

/**
 * Réception d'une candidature d'opérateur (§9).
 *
 * La validation vit ici, côté serveur : celle du navigateur améliore le confort, elle
 * ne protège de rien. Chaque message d'erreur nomme le champ et ce qui ne va pas, en
 * français — « Champ invalide » n'aide personne à corriger.
 */

/** Numéro français, avec ou sans indicatif, espaces et points tolérés. */
const PHONE = /^(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;

const schema = z.object({
  firstName: z.string().trim().min(2, "Indiquez votre prénom."),
  lastName: z.string().trim().min(2, "Indiquez votre nom."),
  phone: z.string().trim().regex(PHONE, "Numéro de téléphone français attendu, par exemple 06 12 34 56 78."),
  email: z.string().trim().email("Adresse e-mail invalide."),
  city: z.string().trim().min(2, "Indiquez la ville ou le secteur que vous visez."),
  status: z.enum(["SALARIE", "INDEPENDANT", "DEMANDEUR_EMPLOI", "AUTRE"], {
    message: "Choisissez votre situation actuelle.",
  }),
  experience: z.enum(["AUCUNE", "MOINS_2_ANS", "PLUS_2_ANS", "PROFESSIONNEL"], {
    message: "Choisissez votre niveau d'expérience.",
  }),
  hasFunding: z.enum(["oui", "non"], { message: "Répondez à la question sur l'apport." }),
  message: z.string().trim().max(2000, "Message trop long.").optional(),
  consent: z.literal("on", { message: "Votre accord est nécessaire pour traiter la candidature." }),
});

/** Ce que le candidat avait saisi, pour le lui rendre si l'envoi est refusé. */
export type ApplicationValues = Record<string, string>;

export type ApplicationState =
  | { status: "idle"; values?: ApplicationValues }
  | { status: "error"; errors: Record<string, string>; message?: string; values: ApplicationValues }
  | { status: "sent" };

/** Extrait les valeurs saisies, sans le piège à robots ni le consentement. */
function keptValues(formData: FormData): ApplicationValues {
  const values: ApplicationValues = {};
  for (const [key, value] of formData.entries()) {
    if (key === "website" || typeof value !== "string") continue;
    values[key] = value;
  }
  return values;
}

export async function submitApplication(
  _previous: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  // Piège à robots : un champ invisible qu'un humain ne remplit jamais. On répond
  // « envoyé » sans rien écrire, pour ne pas renseigner l'automate sur sa détection.
  if (String(formData.get("website") ?? "") !== "") return { status: "sent" };

  const values = keptValues(formData);
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      errors[field] ??= issue.message;
    }
    // On rend les valeurs : un formulaire vidé par une erreur de saisie se remplit
    // une deuxième fois au clavier du téléphone, ou pas du tout.
    return { status: "error", errors, values, message: "Vérifiez les champs signalés." };
  }

  const data = parsed.data;

  try {
    await prisma.operatorApplication.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email.toLowerCase(),
        city: data.city,
        status: data.status,
        experience: data.experience,
        hasFunding: data.hasFunding === "oui",
        message: data.message || null,
        consentAt: new Date(),
      },
    });

    // La candidature remonte dans le back-office : une notification e-mail seule se
    // perd dans une boîte, et la destination CRM n'est pas encore arbitrée (§9).
    await prisma.alert.create({
      data: {
        type: "OPERATOR_APPLICATION",
        severity: "INFO",
        title: "Nouvelle candidature opérateur",
        message: `${data.firstName} ${data.lastName} · ${data.city} · ${data.phone}`,
      },
    });
  } catch {
    return {
      status: "error",
      errors: {},
      values,
      message: "L'envoi n'a pas abouti. Réessayez dans un instant, ou appelez-nous.",
    };
  }

  return { status: "sent" };
}
