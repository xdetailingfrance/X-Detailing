/**
 * Crédibilité géographique d'une position, au regard des zones réellement
 * couvertes.
 *
 * Séparé de src/lib/deplacement.ts, qui porte le barème et qu'importe le
 * tunnel de réservation : celui-ci tourne dans le navigateur, et y faire
 * entrer la base de données embarquerait le pilote PostgreSQL dans le
 * bundle client.
 */
import { db, type Tx } from "@/lib/db";
import { geocoderAdresse, haversineKm } from "@/lib/geo";
import { DEPART, RAYON_PLAUSIBLE_KM, dansLaZonePlausible } from "@/lib/deplacement";

/**
 * Position crédible pour l'entreprise : à portée du départ, ou dans le
 * périmètre d'un secteur.
 *
 * Le garde-fou traque les homonymies, pas les clients lointains. Le jour où
 * un opérateur couvre Toulouse, une adresse toulousaine devient crédible —
 * l'ancrage sur Pompignac seul la rejetterait, et le rendez-vous resterait
 * inattribuable dans la ville même où quelqu'un travaille.
 */
export async function positionPlausible(latitude: number, longitude: number, tx: Tx = db): Promise<boolean> {
  if (dansLaZonePlausible(latitude, longitude)) return true;
  const secteurs = await tx.secteur.findMany({
    where: { latitude: { not: null }, longitude: { not: null }, rayonKm: { not: null } },
    select: { latitude: true, longitude: true, rayonKm: true },
  });
  return secteurs.some(
    (s) => haversineKm(s.latitude!, s.longitude!, latitude, longitude) <= s.rayonKm! + RAYON_PLAUSIBLE_KM
  );
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
  return (await positionPlausible(point.latitude, point.longitude)) ? point : null;
}
