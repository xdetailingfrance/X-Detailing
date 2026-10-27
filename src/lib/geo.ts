// Estimation de trajet routier à partir de coordonnées GPS.
// MVP : formule haversine + vitesse moyenne urbaine. À remplacer en Phase 4
// par un vrai service cartographique (matrices de temps, trafic réel — section 32).

const RAYON_TERRE_KM = 6371;
const VITESSE_MOYENNE_KMH = 28;
const TEMPS_TAMPON_MINUTES = 5; // stationnement, installation matériel, etc.

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return RAYON_TERRE_KM * c;
}

export function estimerTrajetMinutes(distanceKm: number): number {
  return (distanceKm / VITESSE_MOYENNE_KMH) * 60 + TEMPS_TAMPON_MINUTES;
}

// Géocodage d'une adresse française via la Base Adresse Nationale
// (api-adresse.data.gouv.fr : publique, gratuite, sans clé). Nécessaire au
// moteur d'affectation pour les adresses saisies sans coordonnées. Renvoie
// null si l'adresse est introuvable ou le service injoignable.
export async function geocoderAdresse(
  adresse: string,
  ville: string,
  codePostal?: string | null
): Promise<{ latitude: number; longitude: number } | null> {
  const q = [adresse, codePostal, ville].filter(Boolean).join(" ");
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=1`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const [longitude, latitude] = data.features?.[0]?.geometry?.coordinates ?? [];
    return typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}

