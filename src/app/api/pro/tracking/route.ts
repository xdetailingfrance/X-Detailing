import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/guard";
import { recordPing } from "@/server/tracking";

/**
 * Réception des positions de l'application opérateur (§11).
 *
 * Le refus n'est pas une erreur : quand le rendez-vous n'est plus en trajet, la réponse
 * demande explicitement à l'application d'arrêter d'émettre.
 */

export const runtime = "nodejs";

const schema = z.object({
  appointmentId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10_000).nullable().optional(),
  headingDeg: z.number().min(0).max(360).nullable().optional(),
  speedKph: z.number().min(0).max(400).nullable().optional(),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "OPERATOR" || !user.operatorId) {
    return NextResponse.json({ error: "Non autorisé", stopTracking: true }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Position invalide" }, { status: 422 });
  }

  const result = await recordPing({ ...parsed.data, operatorId: user.operatorId });

  // 409 plutôt que 403 : ce n'est pas un défaut de droits, c'est un état qui a changé.
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
