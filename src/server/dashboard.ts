import { prisma } from "./db";
import {
  startOfLocalDay,
  endOfLocalDay,
  startOfLocalWeek,
  startOfLocalMonth,
  addMonths,
} from "./time";

/**
 * Agrégats du tableau de bord central (§20) et des statistiques opérateurs (§22).
 *
 * Un seul passage par période : le back-office doit rester rapide avec plusieurs
 * milliers de rendez-vous (§33).
 */

export type Period = "jour" | "semaine" | "mois";

/** Statuts qui comptent comme du chiffre d'affaires engagé. */
const BILLABLE = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

const LIVE_STATUSES = [
  "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

export function periodRange(period: Period, now = new Date()): { start: Date; end: Date } {
  if (period === "jour") return { start: startOfLocalDay(now), end: endOfLocalDay(now) };
  if (period === "semaine") {
    const start = startOfLocalWeek(now);
    return { start, end: new Date(start.getTime() + 7 * 24 * 3600_000) };
  }
  return { start: startOfLocalMonth(now), end: addMonths(now, 1) };
}

export type OperatorRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  qualityScore: number;
  targetJobsPerDay: number;
  jobsToday: number;
  revenueTodayCents: number;
  jobsInPeriod: number;
  revenuePeriodCents: number;
  commissionPeriodCents: number;
  averageBasketCents: number;
  fillRate: number;
  loadLevel: "LOW" | "MEDIUM" | "HIGH";
};

export async function getDashboard(period: Period, now = new Date()) {
  const { start, end } = periodRange(period, now);
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  const [operators, periodJobs, todayJobs, liveToday, payments, cancelled, alerts] =
    await Promise.all([
      prisma.operator.findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { code: "asc" },
        select: {
          id: true, code: true, firstName: true, lastName: true, status: true,
          qualityScore: true, targetJobsPerDay: true, commissionRate: true,
        },
      }),
      prisma.appointment.groupBy({
        by: ["operatorId"],
        where: { scheduledStart: { gte: start, lt: end }, status: { in: [...BILLABLE] } },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ["operatorId"],
        where: { scheduledStart: { gte: dayStart, lt: dayEnd }, status: { in: [...BILLABLE] } },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { scheduledStart: { gte: dayStart, lt: dayEnd }, status: { in: [...LIVE_STATUSES] } },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ["method", "status"],
        where: { createdAt: { gte: start, lt: end } },
        _sum: { amountCents: true },
      }),
      prisma.appointment.count({
        where: { scheduledStart: { gte: start, lt: end }, status: { in: ["CANCELLED", "NO_SHOW"] } },
      }),
      prisma.alert.findMany({
        where: { status: "OPEN" },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: { operator: { select: { code: true, firstName: true, lastName: true } } },
      }),
    ]);

  const periodByOperator = new Map(
    periodJobs.map((r) => [r.operatorId, { cents: r._sum.totalCents ?? 0, count: r._count._all }]),
  );
  const todayByOperator = new Map(
    todayJobs.map((r) => [r.operatorId, { cents: r._sum.totalCents ?? 0, count: r._count._all }]),
  );

  const rows: OperatorRow[] = operators.map((operator) => {
    const inPeriod = periodByOperator.get(operator.id) ?? { cents: 0, count: 0 };
    const today = todayByOperator.get(operator.id) ?? { cents: 0, count: 0 };
    const fillRate = operator.targetJobsPerDay > 0 ? today.count / operator.targetJobsPerDay : 0;

    return {
      id: operator.id,
      code: operator.code,
      name: `${operator.firstName} ${operator.lastName}`,
      status: operator.status,
      qualityScore: operator.qualityScore,
      targetJobsPerDay: operator.targetJobsPerDay,
      jobsToday: today.count,
      revenueTodayCents: today.cents,
      jobsInPeriod: inPeriod.count,
      revenuePeriodCents: inPeriod.cents,
      commissionPeriodCents: Math.round(inPeriod.cents * Number(operator.commissionRate)),
      averageBasketCents: inPeriod.count > 0 ? Math.round(inPeriod.cents / inPeriod.count) : 0,
      fillRate: Math.round(fillRate * 100) / 100,
      loadLevel: fillRate < 0.5 ? "LOW" : fillRate < 0.85 ? "MEDIUM" : "HIGH",
    };
  });

  const revenueCents = rows.reduce((sum, r) => sum + r.revenuePeriodCents, 0);
  const jobsCount = rows.reduce((sum, r) => sum + r.jobsInPeriod, 0);
  const commissionCents = rows.reduce((sum, r) => sum + r.commissionPeriodCents, 0);

  const paid = (method: string) =>
    payments
      .filter((p) => p.method === method && p.status === "PAID")
      .reduce((sum, p) => sum + (p._sum.amountCents ?? 0), 0);

  const unpaidCents = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + (p._sum.amountCents ?? 0), 0);

  return {
    period,
    range: { start, end },
    network: {
      revenueCents,
      commissionCents,
      jobsCount,
      averageBasketCents: jobsCount > 0 ? Math.round(revenueCents / jobsCount) : 0,
      cancelledCount: cancelled,
    },
    payments: { cardCents: paid("CARD_LINK"), cashCents: paid("CASH"), unpaidCents },
    live: Object.fromEntries(liveToday.map((r) => [r.status, r._count._all])) as Record<string, number>,
    operators: rows,
    alerts,
  };
}
