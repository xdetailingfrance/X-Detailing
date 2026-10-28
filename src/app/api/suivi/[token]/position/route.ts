import { NextResponse } from "next/server";
import { estimerTrajetMinutes, haversineKm, itineraireRoutier } from "@/lib/geo";
import { rendezVousAvecRelations } from "@/lib/queries";
import { rendezVousParToken } from "@/lib/workflow";

/**
 * Où en est l'opérateur, pour le client qui détient le jeton de suivi.
 *
 * Ne renvoie que ce qui le concerne : la position, la distance et le temps
 * restants. Jamais l'identité de l'opérateur, jamais ses autres rendez-vous.
 * Rien n'est exposé hors trajet.
 */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = await rendezVousParToken(token);
  if (!base) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  if (base.statut !== "EN_ROUTE" || base.positionLatitude == null || base.positionLongitude == null) {
    return NextResponse.json({ enRoute: false });
  }

  const rdv = await rendezVousAvecRelations(base.id);
  const destLat = rdv?.adresse.latitude;
  const destLng = rdv?.adresse.longitude;

  // Sans coordonnées de destination, on rend quand même la position : une
  // carte qui avance vaut mieux qu'un écran vide, même sans durée annoncée.
  let distanceKm: number | null = null;
  let minutes: number | null = null;

  if (typeof destLat === "number" && typeof destLng === "number") {
    const route = await itineraireRoutier(base.positionLatitude, base.positionLongitude, destLat, destLng);
    if (route) {
      distanceKm = route.distanceKm;
      minutes = route.minutes;
    } else {
      // Repli géométrique : le service d'itinéraires ne doit pas faire
      // disparaître l'information, seulement la rendre moins précise.
      distanceKm = Math.round(haversineKm(base.positionLatitude, base.positionLongitude, destLat, destLng) * 10) / 10;
      minutes = Math.round(estimerTrajetMinutes(distanceKm));
    }
  }

  return NextResponse.json({
    enRoute: true,
    latitude: base.positionLatitude,
    longitude: base.positionLongitude,
    positionAt: base.positionAt,
    distanceKm,
    minutes,
  });
}
