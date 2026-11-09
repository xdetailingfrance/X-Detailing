import { haversineKm, itineraireRoutier } from "@/lib/geo";

/**
 * Frais de déplacement, par tranche de distance routière.
 *
 * Le barème appartient au secteur : il a son propre point de départ (la
 * ville qui le centre) et ses propres tranches. Facturer un client
 * toulousain au kilométrage depuis Pompignac n'aurait aucun sens.
 *
 * Les valeurs ci-dessous sont celles du secteur historique, et servent de
 * repli tant qu'un secteur n'a pas son barème. Ce fichier ne lit jamais la
 * base : il est importé par le tunnel de réservation, qui tourne dans le
 * navigateur. La résolution du secteur applicable vit dans lib/zone.ts.
 *
 * Au-delà de la dernière tranche, aucun tarif n'est fixé : le devis le signale
 * plutôt que d'inventer un montant.
 */

export const DEPART = { latitude: 44.847993, longitude: -0.442582, libelle: "Pompignac (33)" } as const;

export type Tranche = { jusquaKm: number; prix: number };

export const TRANCHES_DEPLACEMENT: ReadonlyArray<Tranche> = [
  { jusquaKm: 10, prix: 0 },
  { jusquaKm: 20, prix: 10 },
  { jusquaKm: 30, prix: 15 },
] as const;

export function distanceMaxTarifee(tranches: ReadonlyArray<Tranche> = TRANCHES_DEPLACEMENT) {
  return tranches.length === 0 ? 0 : tranches[tranches.length - 1].jusquaKm;
}

export const DISTANCE_MAX_TARIFEE = distanceMaxTarifee();

/**
 * Lit un barème saisi en base. Les tranches sont remises dans l'ordre et les
 * valeurs aberrantes écartées : un barème à moitié valide facturerait des
 * montants au hasard, un barème vide retombe proprement sur le défaut.
 */
export function lireTranches(brut: unknown): ReadonlyArray<Tranche> | null {
  if (!Array.isArray(brut) || brut.length === 0) return null;
  const tranches: Tranche[] = [];
  for (const t of brut) {
    const jusquaKm = Number((t as Tranche)?.jusquaKm);
    const prix = Number((t as Tranche)?.prix);
    if (!Number.isFinite(jusquaKm) || jusquaKm <= 0) return null;
    if (!Number.isFinite(prix) || prix < 0) return null;
    tranches.push({ jusquaKm, prix });
  }
  return tranches.sort((a, b) => a.jusquaKm - b.jusquaKm);
}

/**
 * Le supplément correspondant à une distance, ou `null` au-delà du barème.
 *
 * `null` ne vaut pas zéro : il signifie « tarif particulier », et l'appelant
 * doit le dire au lieu de facturer un déplacement gratuit.
 */
export function fraisDeplacement(
  distanceKm: number,
  tranches: ReadonlyArray<Tranche> = TRANCHES_DEPLACEMENT
): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return null;
  const tranche = tranches.find((t) => distanceKm <= t.jusquaKm);
  return tranche ? tranche.prix : null;
}

export type Deplacement = {
  distanceKm: number | null;
  frais: number | null;
  horsBareme: boolean;
  /** Secteur dont le barème a servi, ou null pour le barème par défaut. */
  secteur?: { id: string; nom: string } | null;
  /** Dernière borne du barème appliqué, pour le dire à l'écran. */
  distanceMaxKm?: number;
};

/** Distance et frais entre deux points, selon le barème donné. */
export async function calculerDeplacementDepuis(
  depart: { latitude: number; longitude: number },
  latitude: number,
  longitude: number,
  tranches: ReadonlyArray<Tranche> = TRANCHES_DEPLACEMENT
): Promise<Deplacement> {
  const route = await itineraireRoutier(depart.latitude, depart.longitude, latitude, longitude);
  if (!route) return { distanceKm: null, frais: null, horsBareme: false, distanceMaxKm: distanceMaxTarifee(tranches) };

  const frais = fraisDeplacement(route.distanceKm, tranches);
  return {
    distanceKm: route.distanceKm,
    frais,
    horsBareme: frais === null,
    distanceMaxKm: distanceMaxTarifee(tranches),
  };
}

/** Barème historique, depuis Pompignac. */
export async function calculerDeplacement(latitude: number, longitude: number): Promise<Deplacement> {
  return calculerDeplacementDepuis(DEPART, latitude, longitude);
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

/** À portée du point de départ historique, sans consulter la base. */
export function dansLaZonePlausible(latitude: number, longitude: number) {
  return haversineKm(DEPART.latitude, DEPART.longitude, latitude, longitude) <= RAYON_PLAUSIBLE_KM;
}
