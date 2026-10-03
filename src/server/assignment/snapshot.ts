import { prisma } from "../db";
import { startOfLocalDay, endOfLocalDay, startOfLocalWeek } from "../time";
import type { OperatorSnapshot } from "./types";

/**
 * Constitution de l'instantané du réseau pour un jour donné.
 *
 * Partagé par l'affectation d'un rendez-vous précis (`service.ts`) et par la recherche de
 * créneaux disponibles du tunnel client (`availability.ts`). Une seule définition de « ce
 * que le moteur voit » : si les deux divergeaient, un créneau proposé au client pourrait
 * être refusé à la validation.
 */

/** Statuts qui occupent réellement l'agenda d'un opérateur. */
const ACTIVE_STATUSES = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

export type SnapshotOptions = {
  /** Rendez-vous à ignorer — utile lors d'une réaffectation. */
  excludeAppointmentId?: string | null;
  /**
   * `true` pour ne charger que les opérateurs actifs (tunnel client), `false` pour
   * charger aussi les suspendus afin que le back-office puisse expliquer leur absence.
   */
  activeOnly?: boolean;
};

export async function loadOperatorSnapshots(
  day: Date,
  options: SnapshotOptions = {},
): Promise<OperatorSnapshot[]> {
  const dayStart = startOfLocalDay(day);
  const dayEnd = endOfLocalDay(day);
  const weekStart = startOfLocalWeek(day);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600_000);

  const operators = await prisma.operator.findMany({
    where: options.activeOnly ? { status: "ACTIVE" } : { status: { not: "ARCHIVED" } },
    include: {
      workingHours: true,
      services: { select: { serviceId: true } },
      coverage: { select: { sectorId: true } },
      timeOff: { where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } } },
    },
  });

  if (operators.length === 0) return [];

  const operatorIds = operators.map((o) => o.id);
  const exclude = options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {};

  const [dayJobs, weekTotals] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        operatorId: { in: operatorIds },
        scheduledStart: { gte: dayStart, lt: dayEnd },
        status: { in: [...ACTIVE_STATUSES] },
        ...exclude,
      },
      select: {
        id: true, operatorId: true, reference: true, city: true,
        scheduledStart: true, scheduledEnd: true, lat: true, lng: true, totalCents: true,
      },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.appointment.groupBy({
      by: ["operatorId"],
      where: {
        operatorId: { in: operatorIds },
        scheduledStart: { gte: weekStart, lt: weekEnd },
        status: { in: [...ACTIVE_STATUSES] },
        ...exclude,
      },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
  ]);

  const weekByOperator = new Map(
    weekTotals.map((row) => [
      row.operatorId,
      { revenueCents: row._sum.totalCents ?? 0, count: row._count._all },
    ]),
  );

  return operators.map((operator) => {
    const jobs = dayJobs.filter((j) => j.operatorId === operator.id);
    const week = weekByOperator.get(operator.id) ?? { revenueCents: 0, count: 0 };

    return {
      id: operator.id,
      code: operator.code,
      name: `${operator.firstName} ${operator.lastName}`,
      status: operator.status,
      home: { lat: operator.homeLat, lng: operator.homeLng },
      homeSectorId: operator.homeSectorId,
      sectorIds: [
        ...new Set([
          ...(operator.homeSectorId ? [operator.homeSectorId] : []),
          ...operator.coverage.map((c) => c.sectorId),
        ]),
      ],
      serviceIds: operator.services.map((s) => s.serviceId),
      qualityScore: operator.qualityScore,
      targetJobsPerDay: operator.targetJobsPerDay,
      maxTravelMinOverride: operator.maxTravelMinOverride,
      workingHours: operator.workingHours.map((w) => ({
        weekday: w.weekday,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
        breakStartMinute: w.breakStartMinute,
        breakEndMinute: w.breakEndMinute,
      })),
      timeOff: operator.timeOff.map((t) => ({ start: t.startAt, end: t.endAt })),
      jobsOnDay: jobs.map((j) => ({
        id: j.id,
        start: j.scheduledStart,
        end: j.scheduledEnd,
        lat: j.lat,
        lng: j.lng,
        label: `${j.reference} · ${j.city}`,
      })),
      revenueTodayCents: jobs.reduce((sum, j) => sum + j.totalCents, 0),
      revenueWeekCents: week.revenueCents,
      jobsWeekCount: week.count,
    };
  });
}
