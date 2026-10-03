import { NextResponse } from "next/server";
import { getClientTracking } from "@/server/tracking";
import { sseResponse } from "@/lib/sse";

/**
 * Suivi client en direct (§11).
 *
 * Authentifié par le jeton aléatoire de la réservation : le client n'a pas de compte.
 * Le module de suivi ne renvoie une position que pendant le trajet — cette route n'a
 * donc aucune règle de confidentialité à appliquer elle-même.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Plafond de l'hébergeur ; le flux se referme avant et le client se reconnecte (§11).
export const maxDuration = 60;

const REFRESH_MS = 5_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const initial = await getClientTracking(token);
  if (!initial) return new NextResponse("Introuvable", { status: 404 });

  // Hors trajet, inutile d'ouvrir un flux : l'état ne bougera pas de lui-même.
  if (initial.status !== "EN_ROUTE") {
    return NextResponse.json(initial, { headers: { "Cache-Control": "no-store" } });
  }

  return sseResponse({
    intervalMs: REFRESH_MS,
    signal: request.signal,
    maxDurationMs: 60 * 60_000,
    tick: async () => (await getClientTracking(token)) ?? { status: "UNKNOWN" },
  });
}
