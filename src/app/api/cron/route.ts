import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueJobs, runJobByName } from "@/server/jobs";

/**
 * Déclenchement des tâches récurrentes (§37 phase 6).
 *
 * Volontairement externe : un ordonnanceur embarqué dans le processus web lierait les
 * tâches à une instance unique, ce qui casserait dès la première mise à l'échelle
 * horizontale. Ici, n'importe quel ordonnanceur convient — cron système, Vercel Cron,
 * GitHub Actions — tant qu'il présente le secret.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron?job=meteo&force=1
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Sans secret configuré, l'endpoint reste fermé : une tâche accessible à tous
  // permettrait de déclencher des envois en boucle.
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const job = params.get("job");
  const force = params.get("force") === "1";

  const outcomes = job ? [await runJobByName(job, { force })] : await runDueJobs();

  const failed = outcomes.filter((o) => o.status === "FAILED");

  // 207 : certaines tâches ont échoué, d'autres non. L'ordonnanceur doit pouvoir le
  // distinguer d'un échec total sans lire le corps de la réponse.
  return NextResponse.json(
    { ran: outcomes.length, outcomes },
    { status: failed.length === 0 ? 200 : failed.length === outcomes.length ? 500 : 207 },
  );
}
