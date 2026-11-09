/**
 * Barème de déplacement applicable à une adresse.
 *
 * Le secteur qui couvre l'adresse décide à la fois du point de départ (sa
 * ville au centre) et des tranches facturées. À défaut de secteur couvrant,
 * on retombe sur le barème historique depuis Pompignac — ce qui est le
 * comportement d'aujourd'hui, tant qu'aucun périmètre n'est renseigné.
 *
 * Séparé de lib/deplacement.ts, qui reste sans accès à la base parce que le
 * tunnel de réservation l'importe et tourne dans le navigateur.
 */
import { db, type Tx } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import {
  DEPART,
  TRANCHES_DEPLACEMENT,
  type Deplacement,
  type Tranche,
  calculerDeplacementDepuis,
  lireTranches,
} from "@/lib/deplacement";

export type BaremeApplicable = {
  depart: { latitude: number; longitude: number; libelle: string };
  tranches: ReadonlyArray<Tranche>;
  secteur: { id: string; nom: string } | null;
};

/** Le secteur dont le périmètre contient ce point, le plus serré d'abord. */
export async function secteurCouvrant(latitude: number, longitude: number, tx: Tx = db) {
  const secteurs = await tx.secteur.findMany({
    where: { latitude: { not: null }, longitude: { not: null }, rayonKm: { not: null } },
  });
  const couvrants = secteurs
    .map((s) => ({ secteur: s, distance: haversineKm(s.latitude!, s.longitude!, latitude, longitude) }))
    .filter(({ secteur, distance }) => distance <= secteur.rayonKm!)
    // Deux périmètres qui se chevauchent : le plus proche du centre l'emporte,
    // c'est celui qui décrit le mieux l'endroit.
    .sort((a, b) => a.distance - b.distance);
  return couvrants[0]?.secteur ?? null;
}

export async function baremePour(latitude: number, longitude: number, tx: Tx = db): Promise<BaremeApplicable> {
  const secteur = await secteurCouvrant(latitude, longitude, tx);
  if (!secteur || secteur.latitude == null || secteur.longitude == null) {
    return { depart: DEPART, tranches: TRANCHES_DEPLACEMENT, secteur: null };
  }
  return {
    depart: { latitude: secteur.latitude, longitude: secteur.longitude, libelle: secteur.ville ?? secteur.nom },
    tranches: lireTranches(secteur.tranches) ?? TRANCHES_DEPLACEMENT,
    secteur: { id: secteur.id, nom: secteur.nom },
  };
}

/** Distance et frais pour une adresse, au barème de son secteur. */
export async function deplacementPourAdresse(latitude: number, longitude: number, tx: Tx = db): Promise<Deplacement> {
  const bareme = await baremePour(latitude, longitude, tx);
  const deplacement = await calculerDeplacementDepuis(bareme.depart, latitude, longitude, bareme.tranches);
  return { ...deplacement, secteur: bareme.secteur };
}
