import { prisma } from "./db";
import { startOfLocalDay, startOfLocalMonth, startOfLocalWeek } from "./time";

/**
 * Statistiques opérateurs (§22) et analyse de la répartition (§5).
 *
 * Le §22 liste les indicateurs ; le §5 demande d'« historiser les affectations afin
 * d'analyser si la répartition du CA est équilibrée ». Les deux vivent ensemble : une
 * liste de CA par opérateur ne dit pas si la répartition est juste, et un indice
 * d'équité sans le détail ne dit pas quoi corriger.
 */

const BILLABLE = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

export type Period = "semaine" | "mois" | "trimestre";

export function periodStart(period: Period, now = new Date()): Date {
  if (period === "semaine") return startOfLocalWeek(now);
  if (period === "mois") return startOfLocalMonth(now);
  return new Date(startOfLocalMonth(now).getTime() - 60 * 24 * 3600_000);
}

export type OperatorStats = {
  id: string;
  code: string;
  name: string;
  sector: string | null;
  status: string;
  jobs: number;
  revenueCents: number;
  commissionCents: number;
  averageBasketCents: number;
  /** Prestations réalisées rapportées à l'objectif quotidien, sur les jours travaillés. */
  fillRate: number;
  travelMin: number;
  distanceKm: number;
  /** Part des prestations démarrées à l'heure (tolérance 10 min). */
  punctuality: number | null;
  cancellations: number;
  noShows: number;
  reviewCount: number;
  averageRating: number | null;
  lowReviews: number;
  qualityScore: number;
};

/**
 * Indice de Gini sur la répartition du CA (§5).
 *
 * 0 = parfaitement égal, 1 = tout le CA sur un seul opérateur. Préféré à un simple
 * écart-type parce qu'il est sans unité : comparable d'un mois à l'autre et d'un secteur
 * à l'autre, quel que soit le volume.
 */
export function giniCoefficient(values: number[]): number | null {
  const positive = values.filter((v) => v >= 0);
  if (positive.length < 2) return null;

  const total = positive.reduce((sum, v) => sum + v, 0);
  if (total === 0) return 0;

  const sorted = [...positive].sort((a, b) => a - b);
  const n = sorted.length;
  const weighted = sorted.reduce((sum, value, index) => sum + (index + 1) * value, 0);

  return Math.round(((2 * weighted) / (n * total) - (n + 1) / n) * 1000) / 1000;
}

export async function getOperatorStatistics(period: Period, now = new Date()) {
  const start = periodStart(period, now);
  const dayStart = startOfLocalDay(now);

  const [operators, appointments, reviews, runs] = await Promise.all([
    prisma.operator.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, firstName: true, lastName: true, status: true,
        qualityScore: true, targetJobsPerDay: true, commissionRate: true,
        homeSector: { select: { name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { scheduledStart: { gte: start }, operatorId: { not: null } },
      select: {
        operatorId: true, status: true, totalCents: true, scheduledStart: true,
        startedAt: true, travelMinEstimate: true, distanceKmEstimate: true,
      },
    }),
    prisma.review.findMany({
      where: { createdAt: { gte: start } },
      select: { operatorId: true, rating: true },
    }),
    prisma.assignmentRun.findMany({
      where: { createdAt: { gte: start }, appointmentId: { not: null } },
      select: { manualOverride: true, candidates: true, chosenOperatorId: true },
    }),
  ]);

  const stats: OperatorStats[] = operators.map((operator) => {
    const own = appointments.filter((a) => a.operatorId === operator.id);
    const billable = own.filter((a) => (BILLABLE as readonly string[]).includes(a.status));
    const revenueCents = billable.reduce((sum, a) => sum + a.totalCents, 0);

    const started = own.filter((a) => a.startedAt !== null);
    const onTime = started.filter(
      (a) => a.startedAt!.getTime() - a.scheduledStart.getTime() <= 10 * 60_000,
    );

    const ratings = reviews.filter((r) => r.operatorId === operator.id);
    const workedDays = new Set(
      billable.map((a) => startOfLocalDay(a.scheduledStart).toISOString()),
    ).size;

    return {
      id: operator.id,
      code: operator.code,
      name: `${operator.firstName} ${operator.lastName}`,
      sector: operator.homeSector?.name ?? null,
      status: operator.status,
      jobs: billable.length,
      revenueCents,
      commissionCents: Math.round(revenueCents * Number(operator.commissionRate)),
      averageBasketCents: billable.length ? Math.round(revenueCents / billable.length) : 0,
      fillRate:
        workedDays > 0 && operator.targetJobsPerDay > 0
          ? Math.round((billable.length / (workedDays * operator.targetJobsPerDay)) * 100) / 100
          : 0,
      travelMin: billable.reduce((sum, a) => sum + (a.travelMinEstimate ?? 0), 0),
      distanceKm:
        Math.round(billable.reduce((sum, a) => sum + (a.distanceKmEstimate ?? 0), 0) * 10) / 10,
      punctuality: started.length > 0 ? Math.round((onTime.length / started.length) * 100) : null,
      cancellations: own.filter((a) => a.status === "CANCELLED").length,
      noShows: own.filter((a) => a.status === "NO_SHOW").length,
      reviewCount: ratings.length,
      averageRating: ratings.length
        ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
        : null,
      lowReviews: ratings.filter((r) => r.rating <= 3).length,
      qualityScore: operator.qualityScore,
    };
  });

  // ── §5 : la répartition est-elle équilibrée ? ─────────────────────────────
  const active = stats.filter((s) => s.status === "ACTIVE");
  const revenues = active.map((s) => s.revenueCents);
  const gini = giniCoefficient(revenues);

  const overrides = runs.filter((r) => r.manualOverride).length;

  // Combien de fois le premier candidat du moteur a-t-il été retenu ?
  const followed = runs.filter((run) => {
    const candidates = run.candidates as Array<{ operatorId: string }> | null;
    return candidates?.[0]?.operatorId === run.chosenOperatorId;
  }).length;

  return {
    period,
    start,
    dayStart,
    operators: stats,
    network: {
      revenueCents: stats.reduce((sum, s) => sum + s.revenueCents, 0),
      commissionCents: stats.reduce((sum, s) => sum + s.commissionCents, 0),
      jobs: stats.reduce((sum, s) => sum + s.jobs, 0),
      cancellations: stats.reduce((sum, s) => sum + s.cancellations, 0),
    },
    balance: {
      gini,
      spreadCents: revenues.length > 1 ? Math.max(...revenues) - Math.min(...revenues) : 0,
      assignmentRuns: runs.length,
      manualOverrides: overrides,
      engineFollowRate: runs.length > 0 ? Math.round((followed / runs.length) * 100) : null,
    },
  };
}
