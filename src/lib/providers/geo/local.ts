import type { GeoProvider, GeocodeResult, LatLng, TravelMatrix, TravelLeg } from "./types";

/**
 * Fournisseur par défaut — fonctionne sans aucun compte tiers.
 *
 * Géocodage : Nominatim (OpenStreetMap, gratuit, sans clé).
 * Temps de trajet : distance à vol d'oiseau × facteur routier, puis profil de vitesse
 * dépendant de la distance et de l'heure.
 *
 * LIMITE ASSUMÉE : pas de trafic réel. Le modèle surestime la faisabilité en zone dense
 * et la sous-estime en rural. La marge de sécurité configurable (§6) absorbe l'écart le
 * temps de la Phase 1 ; basculer sur `google` avant la mise en production.
 */

const EARTH_RADIUS_KM = 6371;

/** Rapport entre distance routière réelle et distance à vol d'oiseau. */
const ROAD_FACTOR = 1.35;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Vitesse moyenne selon la distance : un trajet long emprunte des voies plus rapides. */
function baseSpeedKph(roadKm: number): number {
  if (roadKm < 3) return 20;
  if (roadKm < 8) return 28;
  if (roadKm < 20) return 42;
  if (roadKm < 50) return 62;
  return 78;
}

/** Heures de pointe françaises, approximation volontairement grossière. */
function rushHourFactor(departAt: Date): number {
  const hour = departAt.getHours();
  const day = departAt.getDay();
  if (day === 0 || day === 6) return 1;
  if (hour >= 7 && hour < 9) return 0.72;
  if (hour >= 17 && hour < 19) return 0.7;
  if (hour >= 12 && hour < 14) return 0.88;
  return 1;
}

export function estimateLeg(from: LatLng, to: LatLng, departAt: Date): TravelLeg {
  const roadKm = haversineKm(from, to) * ROAD_FACTOR;
  if (roadKm < 0.05) return { minutes: 0, km: 0 };

  const speed = baseSpeedKph(roadKm) * rushHourFactor(departAt);
  // +2 min forfaitaires : stationnement, sortie de véhicule, recherche de l'adresse.
  const minutes = (roadKm / speed) * 60 + 2;

  return { minutes: Math.round(minutes), km: Math.round(roadKm * 10) / 10 };
}

export class LocalGeoProvider implements GeoProvider {
  readonly name = "local";
  readonly trafficAware = false;

  constructor(private readonly userAgent: string) {}

  async geocode(address: string): Promise<GeocodeResult | null> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "fr");

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;

      const [hit] = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
        addresstype?: string;
      }>;
      if (!hit) return null;

      return {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        formatted: hit.display_name,
        accuracy: hit.addresstype ?? "unknown",
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
    return {
      legs: origins.map((o) => destinations.map((d) => estimateLeg(o, d, departAt))),
      provider: this.name,
      trafficAware: false,
    };
  }
}
