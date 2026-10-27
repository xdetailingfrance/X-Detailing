import { NextResponse } from "next/server";
import { packAvecTarifs } from "@/lib/queries";
import { creneauxDisponibles } from "@/lib/disponibilites";
import { libererReservationsExpirees } from "@/lib/paiement";

// Public (parcours de réservation de la page d'accueil) : créneaux
// réellement libres pour un pack et un jour donnés.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pack = await packAvecTarifs(searchParams.get("packId") ?? "");
  const jour = searchParams.get("jour") ?? "";
  if (!pack || !pack.actif) return NextResponse.json({ error: "prestation inconnue" }, { status: 400 });
  await libererReservationsExpirees();
  return NextResponse.json({ jour, creneaux: await creneauxDisponibles(jour, pack.dureeMinMinutes) });
}

