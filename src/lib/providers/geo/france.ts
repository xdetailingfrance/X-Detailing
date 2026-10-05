import type { GeoProvider, GeocodeResult, LatLng, TravelMatrix } from "./types";
import { estimateLeg } from "./local";

/**
 * Fournisseur français, sans compte ni clé.
 *
 * Géocodage : Base Adresse Nationale (api-adresse.data.gouv.fr), le référentiel
 * officiel des adresses françaises.
 * Itinéraires : Géoplateforme IGN (data.geopf.fr), distance réellement routière.
 *
 * POURQUOI PAS NOMINATIM. Le service d'OpenStreetMap répond `[]` sur une grande part
 * des adresses françaises au niveau du numéro, et sa politique d'usage interdit
 * l'appel serveur massif : depuis un hébergeur, il renvoie souvent 403. La BAN est
 * faite pour cet usage, connaît les numéros, et corrige les libellés approximatifs.
 */

const BAN = "https://api-adresse.data.gouv.fr/search/";
const IGN = "https://data.geopf.fr/navigation/itineraire";

/** En dessous, l'adresse est trop incertaine pour être retenue sans confirmation. */
const MIN_SCORE = 0.4;

export class FranceGeoProvider implements GeoProvider {
  readonly name = "france";
  /** L'IGN calcule un itinéraire réel mais ne modélise pas le trafic du moment. */
  readonly trafficAware = false;

  async geocode(address: string): Promise<GeocodeResult | null> {
    const url = new URL(BAN);
    url.searchParams.set("q", address);
    url.searchParams.set("limit", "1");
    url.searchParams.set("autocomplete", "0");

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;

      const body = (await res.json()) as {
        features?: Array<{
          geometry: { coordinates: [number, number] };
          properties: { label: string; score: number; type: string };
        }>;
      };

      const hit = body.features?.[0];
      if (!hit || hit.properties.score < MIN_SCORE) return null;

      const [lng, lat] = hit.geometry.coordinates;
      return {
        lat,
        lng,
        formatted: hit.properties.label,
        // La BAN répond `housenumber`, `street`, `locality` ou `municipality`.
        accuracy: hit.properties.type === "housenumber" ? "rooftop" : hit.properties.type,
      };
    } catch {
      return null;
    }
  }

  async travelMatrix(
    origins: LatLng[],
    destinations: LatLng[],
    departAt: Date,
  ): Promise<TravelMatrix> {
    const legs = await Promise.all(
      origins.map((origin) =>
        Promise.all(
          destinations.map(async (destination) => {
            const route = await roadRoute(origin, destination);
            // Repli sur l'estimation géométrique : une tournée doit pouvoir se calculer
            // même si la Géoplateforme ne répond pas.
            return route ?? estimateLeg(origin, destination, departAt);
          }),
        ),
      ),
    );

    return { legs, provider: this.name, trafficAware: false };
  }
}

/**
 * Distance et durée routières entre deux points, ou `null` si le service ne répond pas.
 *
 * `optimization=fastest` : l'itinéraire qu'un conducteur suit réellement, qui n'est pas
 * le plus court. Facturer au plus court reviendrait à facturer un trajet que personne
 * ne fait.
 */
export async function roadRoute(
  from: LatLng,
  to: LatLng,
): Promise<{ minutes: number; km: number } | null> {
  const url = new URL(IGN);
  url.searchParams.set("resource", "bdtopo-osrm");
  url.searchParams.set("start", `${from.lng},${from.lat}`);
  url.searchParams.set("end", `${to.lng},${to.lat}`);
  url.searchParams.set("profile", "car");
  url.searchParams.set("optimization", "fastest");
  url.searchParams.set("getSteps", "false");
  url.searchParams.set("distanceUnit", "kilometer");
  url.searchParams.set("timeUnit", "minute");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const body = (await res.json()) as { distance?: number; duration?: number };
    if (typeof body.distance !== "number" || typeof body.duration !== "number") return null;

    return { minutes: Math.round(body.duration), km: Math.round(body.distance * 10) / 10 };
  } catch {
    return null;
  }
}
