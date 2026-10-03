import { prisma } from "./db";
import { geoProvider, type GeocodeResult } from "@/lib/providers/geo";

/**
 * Géocodage avec cache persistant (§6, §33).
 *
 * Une adresse n'est géocodée qu'une fois : Nominatim limite à 1 requête/seconde et
 * Google facture à l'appel. Le cache est la seule raison pour laquelle la couche
 * fournisseur est enveloppée ici plutôt qu'appelée directement.
 */

function normalize(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const query = normalize(address);
  if (!query) return null;

  const cached = await prisma.geocodeCache.findUnique({ where: { query } });
  if (cached) {
    return {
      lat: cached.lat,
      lng: cached.lng,
      formatted: cached.formatted ?? address,
      accuracy: cached.accuracy ?? "cache",
    };
  }

  const provider = geoProvider();
  const result = await provider.geocode(address);
  if (!result) return null;

  await prisma.geocodeCache.create({
    data: {
      query,
      lat: result.lat,
      lng: result.lng,
      formatted: result.formatted,
      accuracy: result.accuracy,
      provider: provider.name,
    },
  });

  return result;
}
