import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/guard";
import { getNetworkTracking } from "@/server/tracking";
import { sseResponse } from "@/lib/sse";

/** §20 — carte live des opérateurs et des rendez-vous, pour le central. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Plafond de l'hébergeur ; le flux se referme avant et le client se reconnecte (§11).
export const maxDuration = 60;

const REFRESH_MS = 5_000;

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "DISPATCHER")) {
    return new NextResponse("Non autorisé", { status: 401 });
  }

  return sseResponse({
    intervalMs: REFRESH_MS,
    signal: request.signal,
    tick: () => getNetworkTracking(),
  });
}
