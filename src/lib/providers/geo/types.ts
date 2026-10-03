/**
 * Abstraction cartographique (§32).
 *
 * Le moteur d'affectation consomme des minutes et des kilomètres — jamais une API.
 * Changer de fournisseur ne doit toucher aucun fichier de `src/server/assignment/`.
 */

export type LatLng = { lat: number; lng: number };

export type GeocodeResult = {
  lat: number;
  lng: number;
  formatted: string;
  /** `rooftop` | `street` | `city` — sert à signaler une adresse imprécise au conseiller. */
  accuracy: string;
};

export type TravelLeg = {
  minutes: number;
  km: number;
};

/** `legs[i][j]` = trajet de `origins[i]` vers `destinations[j]`. */
export type TravelMatrix = {
  legs: TravelLeg[][];
  provider: string;
  /** true si le fournisseur a tenu compte du trafic réel à `departAt`. */
  trafficAware: boolean;
};

export interface GeoProvider {
  readonly name: string;
  readonly trafficAware: boolean;

  geocode(address: string): Promise<GeocodeResult | null>;

  /**
   * Un seul appel pour toutes les paires (§33) : jamais N appels dans une boucle.
   * `departAt` permet au fournisseur d'appliquer les conditions de circulation.
   */
  travelMatrix(
    origins: LatLng[],
    destinations: LatLng[],
    departAt: Date,
  ): Promise<TravelMatrix>;
}
