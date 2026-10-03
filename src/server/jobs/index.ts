import { prisma } from "../db";
import { findJob, JOBS, type JobDefinition } from "./registry";

export { JOBS, JOB_NAMES, findJob } from "./registry";
export type { JobDefinition, JobSummary } from "./registry";

/**
 * Exécution des tâches récurrentes.
 *
 * Chaque exécution laisse une trace (`JobRun`) : une tâche dont on ne sait pas si elle
 * a tourné ne vaut pas mieux qu'une tâche absente — surtout quand il s'agit d'une
 * politique de conservation de données (§31).
 */

/** Au-delà, une exécution « en cours » est considérée comme perdue. */
const STALE_RUN_MINUTES = 15;

export type JobOutcome =
  | { job: string; status: "SUCCESS"; summary: Record<string, unknown>; durationMs: number }
  | { job: string; status: "FAILED"; error: string; durationMs: number }
  | { job: string; status: "SKIPPED"; reason: string };

async function lastSuccess(job: string): Promise<Date | null> {
  const run = await prisma.jobRun.findFirst({
    where: { job, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return run?.startedAt ?? null;
}

async function isRunning(job: string): Promise<boolean> {
  const running = await prisma.jobRun.findFirst({
    where: {
      job,
      status: "RUNNING",
      startedAt: { gt: new Date(Date.now() - STALE_RUN_MINUTES * 60_000) },
    },
    select: { id: true },
  });
  return running !== null;
}

export async function runJob(
  definition: JobDefinition,
  options: { force?: boolean; now?: Date } = {},
): Promise<JobOutcome> {
  const now = options.now ?? new Date();

  // Deux appels simultanés de l'ordonnanceur ne doivent pas lancer deux fois la tâche.
  if (await isRunning(definition.name)) {
    return { job: definition.name, status: "SKIPPED", reason: "déjà en cours" };
  }

  if (!options.force) {
    const previous = await lastSuccess(definition.name);
    if (previous && now.getTime() - previous.getTime() < definition.everyMinutes * 60_000) {
      const minutes = Math.round((now.getTime() - previous.getTime()) / 60_000);
      return {
        job: definition.name,
        status: "SKIPPED",
        reason: `exécutée il y a ${minutes} min (intervalle ${definition.everyMinutes} min)`,
      };
    }
  }

  const run = await prisma.jobRun.create({
    data: { job: definition.name, startedAt: now, status: "RUNNING" },
    select: { id: true },
  });

  const startedAt = Date.now();

  try {
    const summary = await definition.run();
    const durationMs = Date.now() - startedAt;

    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        summary: summary as never,
        durationMs,
      },
    });

    return { job: definition.name, status: "SUCCESS", summary, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: message, durationMs },
    });

    // L'échec d'une tâche ne doit pas empêcher les suivantes de tourner.
    return { job: definition.name, status: "FAILED", error: message, durationMs };
  }
}

export async function runJobByName(
  name: string,
  options: { force?: boolean } = {},
): Promise<JobOutcome> {
  const definition = findJob(name);
  if (!definition) {
    return { job: name, status: "SKIPPED", reason: "tâche inconnue" };
  }
  return runJob(definition, options);
}

/** Exécute toutes les tâches dont l'intervalle est écoulé. */
export async function runDueJobs(now = new Date()): Promise<JobOutcome[]> {
  const outcomes: JobOutcome[] = [];
  for (const definition of JOBS) {
    outcomes.push(await runJob(definition, { now }));
  }
  return outcomes;
}

export type JobStatusRow = {
  name: string;
  label: string;
  description: string;
  everyMinutes: number;
  lastRunAt: Date | null;
  lastStatus: string | null;
  lastSummary: unknown;
  lastError: string | null;
  lastDurationMs: number | null;
  /** `true` quand l'intervalle est dépassé de plus de moitié : la tâche ne tourne plus. */
  overdue: boolean;
};

export async function getJobStatus(now = new Date()): Promise<JobStatusRow[]> {
  const runs = await prisma.jobRun.findMany({
    where: { job: { in: JOBS.map((j) => j.name) } },
    orderBy: { startedAt: "desc" },
    take: 200,
  });

  return JOBS.map((definition) => {
    const last = runs.find((run) => run.job === definition.name);
    const elapsedMin = last ? (now.getTime() - last.startedAt.getTime()) / 60_000 : Infinity;

    return {
      name: definition.name,
      label: definition.label,
      description: definition.description,
      everyMinutes: definition.everyMinutes,
      lastRunAt: last?.startedAt ?? null,
      lastStatus: last?.status ?? null,
      lastSummary: last?.summary ?? null,
      lastError: last?.error ?? null,
      lastDurationMs: last?.durationMs ?? null,
      overdue: elapsedMin > definition.everyMinutes * 1.5,
    };
  });
}
