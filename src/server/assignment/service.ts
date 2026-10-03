import { prisma } from "../db";
import { geoProvider } from "@/lib/providers/geo";
import { getAssignmentSettings } from "../settings";
import { findBestOperators } from "./engine";
import { loadOperatorSnapshots } from "./snapshot";
import type { AssignmentRequest, AssignmentResult } from "./types";

/**
 * Passerelle entre la base et le moteur.
 *
 * Toute la logique métier reste dans `engine.ts`, qui ne connaît pas Prisma. Ce module
 * ne fait que trois choses : constituer l'instantané du réseau, appeler le moteur,
 * archiver l'exécution (§30).
 */

export type RunAssignmentInput = {
  request: AssignmentRequest;
  requestedByUserId: string | null;
  appointmentId?: string | null;
};

export type RunAssignmentOutput = AssignmentResult & { runId: string };

export async function runAssignment(input: RunAssignmentInput): Promise<RunAssignmentOutput> {
  const { request } = input;

  const settings = await getAssignmentSettings();
  const operators = await loadOperatorSnapshots(request.start, {
    excludeAppointmentId: input.appointmentId,
  });

  if (operators.length === 0) {
    throw new Error("Aucun opérateur enregistré : créez-en un depuis le back-office (§28)");
  }

  const result = await findBestOperators({
    request,
    operators,
    settings,
    geo: geoProvider(),
  });

  // §30 : chaque exécution est archivée, ce qui la rend rejouable lors d'un audit et
  // permet d'analyser a posteriori si la répartition du CA est équilibrée (§5).
  const run = await prisma.assignmentRun.create({
    data: {
      appointmentId: input.appointmentId ?? null,
      requestedByUserId: input.requestedByUserId,
      durationMs: result.durationMs,
      request: JSON.parse(JSON.stringify(request)),
      candidates: JSON.parse(JSON.stringify(result.candidates)),
      rejected: JSON.parse(JSON.stringify(result.rejected)),
      weights: result.weights,
    },
    select: { id: true },
  });

  return { ...result, runId: run.id };
}
