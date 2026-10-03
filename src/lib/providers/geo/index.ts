import { LocalGeoProvider } from "./local";
import { GoogleGeoProvider } from "./google";
import type { GeoProvider } from "./types";

export * from "./types";
export { haversineKm, estimateLeg } from "./local";

let cached: GeoProvider | null = null;

/** Sélection par variable d'environnement — aucun appelant ne connaît le fournisseur. */
export function geoProvider(): GeoProvider {
  if (cached) return cached;

  const choice = process.env.GEO_PROVIDER ?? "local";
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (choice === "google") {
    if (!key) throw new Error("GEO_PROVIDER=google mais GOOGLE_MAPS_API_KEY est vide");
    cached = new GoogleGeoProvider(key);
  } else {
    cached = new LocalGeoProvider(
      process.env.NOMINATIM_USER_AGENT ?? "XDetailingOS/1.0",
    );
  }

  return cached;
}
