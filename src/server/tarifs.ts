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
