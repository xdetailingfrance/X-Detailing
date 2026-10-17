/**
 * Catalogue — source unique des formules, des véhicules et des options.
 *
 * La page, le formulaire et l'e-mail de demande lisent tous ce fichier. Le total
 * d'une demande est recalculé côté serveur à partir d'ici : ce que le navigateur
 * annonce n'est jamais repris tel quel.
 *
 * Les prix sont en euros TTC, tels qu'ils seront facturés.
 */

export const VEHICULES = [
  { id: "citadine", label: "Citadine", exemples: "Clio, 208, Polo, Yaris…" },
  { id: "berline", label: "Berline", exemples: "Série 3, A4, Mégane, break…" },
  { id: "suv", label: "SUV", exemples: "3008, Tiguan, Qashqai, monospace…" },
] as const;

export type VehiculeId = (typeof VEHICULES)[number]["id"];

export const FORMULES = [
  {
    id: "interieur",
    nom: "Formule intérieur",
    court: "Intérieur",
    accroche: "L'habitacle repris en profondeur, du coffre aux seuils de porte.",
    prix: { citadine: 129, berline: 139, suv: 149 },
    inclus: [
      "Aspiration complète de l'habitacle et du coffre",
      "Shampoing des sièges, tapis et moquettes",
      "Nettoyage du cuir et de l'alcantara",
      "Seuils de porte nettoyés et finis",
      "Vitres intérieures sans trace",
      "Plastiques nettoyés, ravivés et protégés",
      "Finition parfumée",
    ],
    note: null,
  },
  {
    id: "complete",
    nom: "Formule intérieur + extérieur",
    court: "Intérieur + extérieur",
    accroche: "Tout l'intérieur, plus la carrosserie lavée à la main.",
    prix: { citadine: 189, berline: 199, suv: 209 },
    inclus: [
      "Tout le contenu de la formule intérieur",
      "Pré-lavage à la mousse active",
      "Lavage manuel haute précision",
      "Passages de roue nettoyés en profondeur",
      "Ouvrants de portes nettoyés",
      "Séchage premium sans trace",
      "Pneumatiques, finition satinée",
      "Contrôle qualité avant restitution",
    ],
    note: "Le lavage extérieur demande un emplacement adapté, où l'eau peut s'écouler.",
  },
] as const;

export type FormuleId = (typeof FORMULES)[number]["id"];
export type Formule = (typeof FORMULES)[number];

/** Options cochables, quelle que soit la formule : toutes portent sur l'intérieur. */
export const OPTIONS = [
  { id: "non-vide", categorie: "État du véhicule", nom: "Véhicule non vidé", prix: 15 },
  { id: "sable", categorie: "État du véhicule", nom: "Présence de sable", prix: 20 },
  { id: "poils", categorie: "État du véhicule", nom: "Poils d'animaux", prix: 25 },

  { id: "shampoing-coffre", categorie: "Shampoing approfondi", nom: "Shampoing du coffre", prix: 20 },
  { id: "siege-bebe", categorie: "Shampoing approfondi", nom: "Shampoing siège auto bébé", prix: 10, unite: "par siège" },
  { id: "plafonnier", categorie: "Shampoing approfondi", nom: "Shampoing plafonnier (ciel de toit)", prix: 60 },

  { id: "cuir", categorie: "Traitement du cuir", nom: "Traitement du cuir", prix: 50 },
  { id: "cuir-hors-sieges", categorie: "Traitement du cuir", nom: "Traitement du cuir, hors sièges", prix: 25 },

  { id: "tapis-sup", categorie: "Tapis et coffre", nom: "Tapis supplémentaire", prix: 20 },
  { id: "tapis-coffre", categorie: "Tapis et coffre", nom: "Tapis de coffre", prix: 15 },
  { id: "sous-coffre", categorie: "Tapis et coffre", nom: "Sous-coffre", prix: 25 },
] as const;

export type OptionId = (typeof OPTIONS)[number]["id"];
export type Option = (typeof OPTIONS)[number];

/** Les catégories, dans l'ordre d'apparition. */
export const CATEGORIES_OPTIONS = [...new Set(OPTIONS.map((o) => o.categorie))];

export const FORMULE_IDS = FORMULES.map((f) => f.id) as [FormuleId, ...FormuleId[]];
export const VEHICULE_IDS = VEHICULES.map((v) => v.id) as [VehiculeId, ...VehiculeId[]];
export const OPTION_IDS = OPTIONS.map((o) => o.id) as [OptionId, ...OptionId[]];

export function formule(id: FormuleId): Formule {
  return FORMULES.find((f) => f.id === id)!;
}

export function vehicule(id: VehiculeId) {
  return VEHICULES.find((v) => v.id === id)!;
}

export function option(id: OptionId): Option {
  return OPTIONS.find((o) => o.id === id)!;
}

/** Le prix de la formule pour ce véhicule. */
export function prixFormule(formuleId: FormuleId, vehiculeId: VehiculeId): number {
  return formule(formuleId).prix[vehiculeId];
}

/** Le plus bas tarif d'une formule — pour « dès 129 € ». */
export function prixMinimum(formuleId: FormuleId): number {
  return Math.min(...Object.values(formule(formuleId).prix));
}

/** Formule + options, en euros. */
export function totalDevis(
  formuleId: FormuleId,
  vehiculeId: VehiculeId,
  optionIds: readonly OptionId[],
): number {
  const options = optionIds.reduce((sum, id) => sum + option(id).prix, 0);
  return prixFormule(formuleId, vehiculeId) + options;
}

export const euros = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
