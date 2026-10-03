import type { GeoProvider, GeocodeResult, LatLng, TravelMatrix, TravelLeg } from "./types";

/**
 * Google Maps Platform — trafic réel (§6 « avec données de circulation lorsque disponibles »).
 *
 * Activer avec GEO_PROVIDER=google et GOOGLE_MAPS_API_KEY.
 * Non testé en l'absence de clé : aucun prestataire n'est acté à ce stade du projet.
 *
 * Coût : Routes API facturée par élément (origines × destinations). Le moteur émet
 * 2 appels par affectation, quel que soit le nombre d'opérateurs.
 */
export class GoogleGeoProvider implements GeoProvider {
  readonly name = "google";
  readonly trafficAware = true;

  constructor(private readonly apiKey: string) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("region", "fr");
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry: { location: { lat: number; lng: number }; location_type: string };
        formatted_address: string;
      }>;
    };

    const hit = data.results?.[0];
    if (data.status !== "OK" || !hit) return null;

    return {
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
      formatted: hit.formatted_address,
      accuracy: hit.geometry.location_type.toLowerCase(),
    };
  }

  async travelMatrix(
    origins: LatLng[],
    destinations: LatLng[],
    departAt: Date,
  ): Promise<TravelMatrix> {
    const waypoint = (p: LatLng) => ({
      waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } },
    });

    const res = await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,distanceMeters,condition",
        },
        body: JSON.stringify({
          origins: origins.map(waypoint),
          destinations: destinations.map(waypoint),
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          departureTime: departAt.toISOString(),
        }),
        signal: AbortSignal.timeout(12000),
      },
    );

    if (!res.ok) {
      throw new Error(`Google Routes API: ${res.status} ${await res.text()}`);
    }

    const rows = (await res.json()) as Array<{
      originIndex: number;
      destinationIndex: number;
      duration?: string;
      distanceMeters?: number;
      condition?: string;
    }>;

    const unreachable: TravelLeg = { minutes: Number.POSITIVE_INFINITY, km: Infinity };
    const legs: TravelLeg[][] = origins.map(() => destinations.map(() => unreachable));

    for (const row of rows) {
      if (row.condition === "ROUTE_NOT_FOUND") continue;
      legs[row.originIndex][row.destinationIndex] = {
        minutes: Math.round(Number((row.duration ?? "0s").replace("s", "")) / 60),
        km: Math.round(((row.distanceMeters ?? 0) / 1000) * 10) / 10,
      };
    }

    return { legs, provider: this.name, trafficAware: true };
  }
}
