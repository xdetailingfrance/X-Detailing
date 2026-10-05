import type { VehicleClass } from "@/generated/prisma/enums";

/**
 * Grille tarifaire — source unique.
 *
 * Le jeu de données initial et le script de mise à jour (`scripts/tarifs.ts`) lisent
 * tous deux ce fichier. Sans ça, changer un prix demandait de le changer à deux
 * endroits, et le second finissait toujours par être oublié.
 *
 * Le tarif ne dépend pas de la taille du véhicule : une prestation, un prix. Les sept
 * classes restent déclarées parce que le moteur d'affectation et la requalification sur
 * place raisonnent dessus — mais elles portent toutes le même montant.
 */

const EUR = (n: number) => n * 100;

export const VEHICLE_CLASSES: readonly VehicleClass[] = [
  "CITADINE",
  "BERLINE",
  "BREAK",
  "SUV",
  "QUATRE_X_QUATRE",
  "UTILITAIRE",
  "SEPT_PLACES",
] as const;

export type Tarif = { priceCents: number; durationMin: number };

/** Ce qui est facturé et le temps passé sur place, par code de prestation. */
export const TARIFS: Record<string, Tarif> = {
  "PACK-CONCESSION": { priceCents: EUR(149), durationMin: 120 },
  "PACK-LUXE": { priceCents: EUR(199), durationMin: 120 },
};

/** La grille complète, dépliée sur les sept classes. */
export function priceGrid(code: string): Array<{
  vehicleClass: VehicleClass;
  priceCents: number;
  compareAtCents: null;
  durationMin: number;
}> {
  const tarif = TARIFS[code];
  if (!tarif) throw new Error(`Tarif absent pour la prestation ${code}`);

  return VEHICLE_CLASSES.map((vehicleClass) => ({
    vehicleClass,
    priceCents: tarif.priceCents,
    // Aucun prix barré : un tarif de référence plus élevé qui n'a jamais été pratiqué
    // est une donnée inventée, et l'affichage d'une remise fictive est sanctionné.
    compareAtCents: null,
    durationMin: tarif.durationMin,
  }));
}


/* ── Le catalogue ─────────────────────────────────────────────────────────── */

/** Les deux formules. `includes` est ce que le client lit, ligne à ligne. */
export const SERVICE_DEFS = [
  {
    code: "PACK-CONCESSION",
    slug: "nettoyage-interieur-voiture",
    name: "Concession",
    kind: "INTERIOR" as const,
    tier: "ESSENTIAL" as const,
    featured: true,
    sortOrder: 1,
    description: "L'habitacle repris en profondeur, du coffre aux seuils de porte.",
    includes: [
      "Aspiration complète de l'habitacle et du coffre",
      "Shampoing des sièges, tapis et moquettes",
      "Nettoyage du cuir et de l'alcantara",
      "Seuils de porte nettoyés et finis",
      "Vitres intérieures sans trace",
      "Plastiques nettoyés, ravivés et protégés",
      "Finition parfumée",
    ],
  },
  {
    code: "PACK-LUXE",
    slug: "nettoyage-complet-voiture",
    name: "Concession Luxe",
    kind: "BOTH" as const,
    tier: "SIGNATURE" as const,
    featured: true,
    sortOrder: 2,
    description:
      "Tout le pack Concession, plus la carrosserie. L'extérieur demande un emplacement adapté.",
    includes: [
      "Tout le contenu du pack Concession",
      "Pré-lavage à la mousse active",
      "Lavage manuel haute précision",
      "Passages de roue nettoyés en profondeur",
      "Ouvrants de portes",
      "Séchage premium sans trace",
      "Pneumatiques, finition satinée",
      "Contrôle qualité avant restitution",
    ],
  },
];

/**
 * Les options, cochables à la réservation.
 *
 * `durationMin` vaut zéro partout : les durées n'ont pas été communiquées. Ce n'est pas
 * un détail cosmétique — le moteur d'affectation additionne ces minutes pour construire
 * les tournées. Un shampooing de plafonnier facturé 60 € qui ne déclare aucune minute
 * fait déborder le départ suivant. À renseigner avant d'ouvrir la vente des options.
 */
export const OPTION_DEFS = [
  // ── État du véhicule ──────────────────────────────────────────────────────
  { code: "OPT-NON-VIDE", category: "État du véhicule", name: "Véhicule non vidé", priceCents: EUR(15), durationMin: 0 },
  { code: "OPT-SABLE", category: "État du véhicule", name: "Présence de sable", priceCents: EUR(20), durationMin: 0 },
  { code: "OPT-POILS", category: "État du véhicule", name: "Poils de chien", priceCents: EUR(25), durationMin: 0 },

  // ── Shampooing et nettoyage approfondi ────────────────────────────────────
  { code: "OPT-SHAMPOING-COFFRE", category: "Shampooing et nettoyage approfondi", name: "Shampooing coffre", priceCents: EUR(20), durationMin: 0 },
  { code: "OPT-SIEGE-BEBE", category: "Shampooing et nettoyage approfondi", name: "Shampooing siège auto bébé (par siège)", priceCents: EUR(10), durationMin: 0 },
  { code: "OPT-PLAFONNIER", category: "Shampooing et nettoyage approfondi", name: "Shampooing plafonnier", priceCents: EUR(60), durationMin: 0 },

  // ── Traitement du cuir ────────────────────────────────────────────────────
  { code: "OPT-CUIR", category: "Traitement du cuir", name: "Traitement du cuir", priceCents: EUR(50), durationMin: 0 },
  { code: "OPT-CUIR-HORS-SIEGES", category: "Traitement du cuir", name: "Traitement cuir (hors sièges)", priceCents: EUR(25), durationMin: 0 },

  // ── Tapis et coffre ───────────────────────────────────────────────────────
  { code: "OPT-TAPIS-SUP", category: "Tapis et coffre", name: "Tapis supplémentaire", priceCents: EUR(20), durationMin: 0 },
  { code: "OPT-TAPIS-COFFRE", category: "Tapis et coffre", name: "Tapis de coffre", priceCents: EUR(15), durationMin: 0 },
  { code: "OPT-SOUS-COFFRE", category: "Tapis et coffre", name: "Sous-coffre", priceCents: EUR(25), durationMin: 0 },
] as const;

/* ── Le déplacement ───────────────────────────────────────────────────────── */

/**
 * Point de départ du réseau : Pompignac (33).
 *
 * Coordonnées du centre de la commune. Le jour où le local a une adresse précise,
 * c'est la seule ligne à corriger — tout le calcul en découle.
 */
export const DEPARTURE = { lat: 44.850415, lng: -0.4382, label: "Pompignac (33)" } as const;

/**
 * Supplément de déplacement, par tranche de distance **routière**.
 *
 * `upToKm` est la borne haute incluse. Au-delà de la dernière tranche, aucun tarif
 * n'a été fixé : la réservation en ligne refuse plutôt que d'inventer un montant.
 */
export const TRAVEL_BANDS: ReadonlyArray<{ upToKm: number; priceCents: number }> = [
  { upToKm: 15, priceCents: EUR(0) },
  { upToKm: 30, priceCents: EUR(10) },
  { upToKm: 45, priceCents: EUR(20) },
  { upToKm: 60, priceCents: EUR(30) },
] as const;

/** Dernière borne couverte, au-delà de laquelle on ne sait pas facturer. */
export const MAX_TRAVEL_KM = TRAVEL_BANDS[TRAVEL_BANDS.length - 1].upToKm;

/**
 * Le supplément correspondant à une distance routière, ou `null` hors zone.
 *
 * `null` n'est pas zéro : il signifie « nous ne desservons pas », et l'appelant doit
 * refuser la réservation plutôt que de la passer sans frais de route.
 */
export function travelFeeCents(roadKm: number): number | null {
  if (!Number.isFinite(roadKm) || roadKm < 0) return null;
  const band = TRAVEL_BANDS.find((b) => roadKm <= b.upToKm);
  return band ? band.priceCents : null;
}
