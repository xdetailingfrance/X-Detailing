import { geocoderAdresse, haversineKm, itineraireRoutier } from "@/lib/geo";

/**
 * Frais de déplacement, par tranche de distance routière.
 *
 * Le point de départ est fixe : Pompignac (33). La distance est calculée par
 * la route et non à vol d'oiseau — un détour par la rocade ne se devine pas
 * avec un rayon.
 *
 * Au-delà de la dernière tranche, aucun tarif n'est fixé : le devis le signale
 * plutôt que d'inventer un montant.
 */

export const DEPART = { latitude: 44.847993, longitude: -0.442582, libelle: "Pompignac (33)" } as const;

export const TRANCHES_DEPLACEMENT: ReadonlyArray<{ jusquaKm: number; prix: number }> = [
  { jusquaKm: 10, prix: 0 },
  { jusquaKm: 20, prix: 10 },
  { jusquaKm: 30, prix: 15 },
] as const;

export const DISTANCE_MAX_TARIFEE = TRANCHES_DEPLACEMENT[TRANCHES_DEPLACEMENT.length - 1].jusquaKm;

/**
 * Le supplément correspondant à une distance, ou `null` au-delà du barème.
 *
 * `null` ne vaut pas zéro : il signifie « tarif particulier », et l'appelant
 * doit le dire au lieu de facturer un déplacement gratuit.
 */
export function fraisDeplacement(distanceKm: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const tranche = TRANCHES_DEPLACEMENT.find((t) => distanceKm <= t.jusquaKm);
  return tranche ? tranche.prix : null;
}

export type Deplacement = {
  distanceKm: number | null;
  frais: number | null;
  horsBareme: boolean;
};

/** Distance et frais depuis le point de départ vers une adresse géocodée. */
export async function calculerDeplacement(latitude: number, longitude: number): Promise<Deplacement> {
  const route = await itineraireRoutier(DEPART.latitude, DEPART.longitude, latitude, longitude);
  if (!route) return { distanceKm: null, frais: null, horsBareme: false };

  const frais = fraisDeplacement(route.distanceKm);
  return { distanceKm: route.distanceKm, frais, horsBareme: frais === null };
}

/**
 * Au-delà de cette distance du point de départ, un résultat de géocodage
 * n'est pas une adresse lointaine : c'est une homonymie.
 *
 * « Carignan » sans code postal désigne la commune des Ardennes, à 700 km,
 * et non Carignan-de-Bordeaux à cinq minutes. Enregistrer ce point rendait
 * le rendez-vous inaffectable avec un message absurde. La zone tarifée
 * s'arrête à 30 km ; on laisse quatre fois cette marge pour les devis à
 * tarif particulier, et on refuse au-delà.
 */
export const RAYON_PLAUSIBLE_KM = 120;

export function dansLaZonePlausible(latitude: number, longitude: number) {
  return haversineKm(DEPART.latitude, DEPART.longitude, latitude, longitude) <= RAYON_PLAUSIBLE_KM;
}

/**
 * Géocode une adresse de l'aire desservie. Le résultat est biaisé vers le
 * point de départ, et rejeté s'il tombe manifestement ailleurs : mieux vaut
 * pas de coordonnées — qui se voient et se corrigent — qu'une position
 * fausse, qui se propage en silence.
 */
export async function geocoderDansLaZone(adresse: string, ville: string, codePostal?: string | null) {
  const point = await geocoderAdresse(adresse, ville, codePostal, DEPART);
  if (!point) return null;
  return dansLaZonePlausible(point.latitude, point.longitude) ? point : null;
}
