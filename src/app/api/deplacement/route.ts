import { NextResponse } from "next/server";
import { calculerDeplacement } from "@/lib/deplacement";
import { geocoderAdresse } from "@/lib/geo";
import { getSession } from "@/lib/session";

/**
 * Frais de route pour une adresse, à la saisie d'un devis.
 *
 * Réservé au back-office : c'est un outil de chiffrage interne, et le laisser
 * ouvert donnerait à n'importe qui un géocodeur et un calculateur
 * d'itinéraires aux frais de l'entreprise.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role === "OPERATEUR") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const adresse = (params.get("adresse") ?? "").trim();
  const ville = (params.get("ville") ?? "").trim();
  const codePostal = params.get("codePostal");
  if (!adresse || !ville) return NextResponse.json({ error: "adresse incomplète" }, { status: 400 });

  const point = await geocoderAdresse(adresse, ville, codePostal);
  if (!point) {
    return NextResponse.json({ error: "Adresse introuvable. Vérifiez le numéro et la ville." }, { status: 404 });
  }

  const deplacement = await calculerDeplacement(point.latitude, point.longitude);
  if (deplacement.distanceKm === null) {
    return NextResponse.json({ error: "Itinéraire indisponible pour le moment." }, { status: 503 });
  }

  return NextResponse.json({
    distanceKm: deplacement.distanceKm,
    frais: deplacement.frais,
    horsBareme: deplacement.horsBareme,
    latitude: point.latitude,
    longitude: point.longitude,
  });
}
