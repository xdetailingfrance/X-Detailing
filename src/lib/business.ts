/**
 * Identité de l'entreprise — source unique.
 *
 * Tout ce qui est factuel sur X Detailing passe par ici : le site, les données
 * structurées, le pied de page et les pages locales lisent les mêmes valeurs. C'est ce
 * qui garantit la cohérence NAP (nom, adresse, téléphone) que Google Local et les
 * moteurs génératifs vérifient d'une source à l'autre.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AUCUNE DONNÉE N'EST INVENTÉE.
 *
 * Les valeurs entre crochets — `[VILLE]`, `[NOTE GOOGLE]` — sont des emplacements
 * à remplir. Elles s'affichent telles quelles à l'écran, volontairement : un
 * emplacement visible se remarque et se corrige, une donnée plausible inventée
 * traverse la mise en ligne sans que personne ne la voie.
 *
 * `isPlaceholder()` permet aux composants de masquer un bloc plutôt que d'afficher
 * un crochet là où ce serait gênant — une note Google inventée dans un balisage
 * Schema, par exemple, expose à une pénalité.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const BUSINESS = {
  name: "X Detailing",
  legalName: "[RAISON SOCIALE]",

  /** Ce que fait l'entreprise, en une phrase citable par un moteur génératif. */
  summary:
    "X Detailing est un service de lavage et de nettoyage automobile qui se déplace " +
    "chez le client, à domicile ou sur son lieu de travail.",

  city: "[VILLE]",
  /** Zone réellement couverte. Les secteurs actifs en base la précisent. */
  area: "[ZONE D'INTERVENTION]",

  address: {
    street: "[ADRESSE]",
    postalCode: "[CODE POSTAL]",
    city: "[VILLE]",
    country: "FR",
  },

  /** Coordonnées de l'atelier ou du point de rattachement. */
  geo: { lat: null as number | null, lng: null as number | null },

  phone: "[TÉLÉPHONE]",
  /** Format international, pour `tel:` et Schema. */
  phoneE164: "[+33XXXXXXXXX]",
  email: "[E-MAIL]",

  /**
   * Horaires d'ouverture. `null` tant qu'ils ne sont pas connus : un horaire inventé
   * envoie un client devant une porte fermée.
   */
  openingHours: null as Array<{ days: string[]; opens: string; closes: string }> | null,

  /** Note et nombre d'avis Google. Jamais renseignés à la main (§32). */
  google: {
    rating: "[NOTE GOOGLE]",
    reviewCount: "[NOMBRE D'AVIS]",
    profileUrl: "[LIEN FICHE GOOGLE]",
  },

  social: {
    instagram: "[INSTAGRAM]",
    facebook: "[FACEBOOK]",
    tiktok: "[TIKTOK]",
  },
} as const;

/** Vrai si la valeur est un emplacement à remplir plutôt qu'une donnée réelle. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]");
}

/** La valeur si elle est réelle, `null` sinon — pour masquer plutôt qu'afficher. */
export function realValue(value: string | null | undefined): string | null {
  return isPlaceholder(value) ? null : (value ?? null);
}

/**
 * Le lien téléphonique, ou `null` si le numéro n'est pas renseigné.
 * Un `tel:` vers un numéro fictif est pire qu'un bouton absent.
 */
export function telHref(): string | null {
  const e164 = realValue(BUSINESS.phoneE164);
  return e164 ? `tel:${e164.replace(/\s/g, "")}` : null;
}

/**
 * Adresse publique du site.
 *
 * Vercel expose le domaine de production ; en local on retombe sur le port de
 * développement. Les URL canoniques et le plan du site en dépendent — les laisser
 * relatives produirait des `canonical` vides.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
