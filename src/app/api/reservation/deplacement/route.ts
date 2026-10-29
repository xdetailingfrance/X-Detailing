import { NextResponse } from "next/server";
import { calculerDeplacement } from "@/lib/deplacement";
import { geocoderAdresse } from "@/lib/geo";

/**
 * Frais de route pour une adresse, pendant la réservation en ligne.
 *
 * Public, contrairement à /api/deplacement : le client doit voir le
 * supplément avant de payer, pas le découvrir sur sa facture. Le montant
 * renvoyé ici n'est qu'un affichage — celui qui est facturé est recalculé
 * par /api/reservation à partir de l'adresse enregistrée.
 *
 * Le débit est limité par adresse IP : chaque appel sollicite deux services
 * publics (Base Adresse Nationale, IGN). S'en faire bannir couperait le
 * calcul au moment d'une vraie réservation.
 */
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 20;
const appels = new Map<string, number[]>();

function tropDAppels(ip: string) {
  const maintenant = Date.now();
  const recents = (appels.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  recents.push(maintenant);
  appels.set(ip, recents);
  // Purge opportuniste : sans cela la table grossit indéfiniment.
  if (appels.size > 500) {
    for (const [cle, dates] of appels) {
      if (dates.every((t) => maintenant - t >= FENETRE_MS)) appels.delete(cle);
    }
  }
  return recents.length > MAX_PAR_FENETRE;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "inconnue";
  if (tropDAppels(ip)) {
    return NextResponse.json({ error: "Trop de demandes. Patientez un instant." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const lire = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const adresse = lire(body?.adresse, 160);
  const ville = lire(body?.ville, 80);
  const codePostal = lire(body?.codePostal, 10) || null;
  if (!adresse || !ville) return NextResponse.json({ error: "adresse incomplète" }, { status: 400 });

  const point = await geocoderAdresse(adresse, ville, codePostal);
  if (!point) {
    return NextResponse.json({ error: "Adresse introuvable. Vérifiez le numéro et la ville." }, { status: 404 });
  }

  const deplacement = await calculerDeplacement(point.latitude, point.longitude);
  if (deplacement.distanceKm === null) {
    return NextResponse.json({ error: "Calcul d'itinéraire indisponible pour le moment." }, { status: 503 });
  }

  return NextResponse.json({
    distanceKm: deplacement.distanceKm,
    frais: deplacement.frais,
    horsBareme: deplacement.horsBareme,
  });
}
