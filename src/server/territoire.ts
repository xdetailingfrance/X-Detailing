import { DEPARTURE, MAX_TRAVEL_KM } from "./tarifs";

/**
 * Le territoire desservi — source unique.
 *
 * Un opérateur ne peut pas être créé sans secteur de rattachement, et aucun écran du
 * back-office ne crée de secteur. Sur une base neuve, cela ferme définitivement la
 * chaîne : pas de secteur, donc pas d'opérateur, donc aucun créneau proposé et aucune
 * réservation possible. Le territoire s'installe donc au déploiement, comme le
 * catalogue.
 *
 * Un seul secteur, parce qu'il n'y a qu'un point de départ. Le jour où le réseau
 * couvre plusieurs villes, on en ajoute ici — le moteur d'affectation en gère autant
 * qu'on veut, et c'est la couverture déclarée de chaque opérateur qui tranche.
 *
 * Le rayon reprend la dernière borne de la grille de déplacement : annoncer une zone
 * plus large que celle qu'on sait facturer produirait des réservations refusées à la
 * dernière étape.
 */

export const REGION = {
  code: "GIRONDE",
  name: "Gironde",
  timezone: "Europe/Paris",
} as const;

export const SECTORS = [
  {
    code: "GIR-POMPIGNAC",
    name: `${DEPARTURE.label.replace(/\s*\(\d+\)$/, "")} et ${MAX_TRAVEL_KM} km alentour`,
    centroidLat: DEPARTURE.lat,
    centroidLng: DEPARTURE.lng,
  },
] as const;
