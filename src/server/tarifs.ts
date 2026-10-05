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

/** Les options, cochables à la réservation ou décidées sur place. */
export const OPTION_DEFS = [
  { code: "OPT-SIEGES", name: "Shampoing sièges", priceCents: EUR(25), durationMin: 30 },
  { code: "OPT-POILS", name: "Retrait poils d'animaux", priceCents: EUR(20), durationMin: 20 },
  { code: "OPT-PLASTIQUES", name: "Rénovation plastiques", priceCents: EUR(15), durationMin: 10 },
  { code: "OPT-JANTES", name: "Jantes traitement intensif", priceCents: EUR(12), durationMin: 10 },
  { code: "OPT-COFFRE", name: "Coffre / soute utilitaire", priceCents: EUR(10), durationMin: 10 },
];
