/**
 * Identité de l'entreprise — source unique.
 *
 * Tout ce qui est factuel sur X Detailing passe par ici : la page, les données
 * structurées, le pied de page et l'e-mail de demande lisent les mêmes valeurs.
 * C'est ce qui garantit la cohérence nom / adresse / téléphone que Google recoupe
 * entre le site et la fiche d'établissement.
 *
 * Les valeurs entre crochets — `[E-MAIL]` — sont des emplacements à remplir. Elles
 * sont masquées à l'écran par `realValue()` plutôt qu'affichées : une donnée
 * inventée traverserait la mise en ligne sans que personne ne la voie.
 */

export const BUSINESS = {
  name: "X Detailing",
  legalName: "X DETAILING",
  legalForm: "SASU",
  siren: "131 212 250",

  /** Ce que fait l'entreprise, en une phrase citable. */
  summary:
    "X Detailing est un service de lavage et de detailing automobile, intérieur et " +
    "extérieur, à domicile et en entreprise, sur Bordeaux et ses alentours.",

  /** La ville que les clients tapent dans Google. */
  city: "Bordeaux",
  area: "Bordeaux, sa métropole et l'Entre-deux-Mers",

  /**
   * Siège social — pour les mentions légales uniquement. L'entreprise se déplace
   * chez le client : la fiche Google n'affiche pas d'adresse, et la page non plus.
   */
  siege: "Parc de Citon B03, chemin de Brondeau, 33370 Pompignac",

  /**
   * Numéro affiché sur la fiche Google de l'établissement. À confirmer : c'est la
   * seule donnée de ce fichier qui n'a pas été communiquée directement.
   */
  phone: "06 49 36 83 28",
  phoneE164: "+33649368328",
  email: "[E-MAIL]",

  /** Domaine de production. */
  url: "https://xdetailing.fr",

  google: {
    /** Lien de partage de la fiche d'établissement. */
    profileUrl: "https://share.google/j9knPSPvVLRsamIPP",
    /** Identifiant de lieu de la fiche, lu sur Google Maps. */
    placeId: "ChIJEzMakwWxtmgRyql-ew6fdeA",
    /** Identifiant client de la même fiche, celui que la carte intégrée accepte. */
    cid: "16174008521321261514",
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

/** Le lien téléphonique, ou `null` si le numéro n'est pas renseigné. */
export function telHref(): string | null {
  const e164 = realValue(BUSINESS.phoneE164);
  return e164 ? `tel:${e164.replace(/\s/g, "")}` : null;
}

/**
 * Lien « laisser un avis » : le formulaire d'avis Google, ouvert directement sur
 * la fiche. `GOOGLE_REVIEW_URL` permet de le remplacer par le lien court fourni
 * dans l'espace « Obtenir plus d'avis » de la fiche d'établissement.
 */
export function reviewUrl(): string {
  return (
    process.env.GOOGLE_REVIEW_URL?.trim() ||
    `https://search.google.com/local/writereview?placeid=${BUSINESS.google.placeId}`
  );
}

/**
 * Carte intégrée, ouverte sur la fiche Google de l'entreprise par son identifiant —
 * jamais par une recherche textuelle : « X DETAILING » près de Bordeaux renvoyait la
 * fiche d'un concurrent. Sans clé d'API.
 */
export function mapEmbedUrl(): string {
  return `https://www.google.com/maps/embed?pb=!1m3!3m2!1m1!4s${BUSINESS.google.cid}!3m1!1sfr!5m1!1sfr`;
}

/**
 * Adresse publique du site.
 *
 * Le domaine de production sert de canonique partout où le site est construit —
 * y compris sur les adresses de prévisualisation `.vercel.app`, qui ne doivent pas
 * se déclarer canoniques d'elles-mêmes. En local, le port de développement.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return BUSINESS.url;
  return "http://localhost:3000";
}
