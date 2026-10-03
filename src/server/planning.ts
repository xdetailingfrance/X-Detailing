import { prisma } from "./db";
import { estimateLeg } from "@/lib/providers/geo";
import { getAssignmentSettings } from "./settings";
import { startOfLocalDay, endOfLocalDay, minutesBetween } from "./time";

/**
 * Planning global (§21) : tous les opérateurs sur une seule interface, avec détection
 * automatique des conflits et des trajets irréalistes.
 *
 * Les temps de trajet affichés ici sont estimés localement (haversine) plutôt que via le
 * fournisseur cartographique : le planning se recalcule à chaque navigation de date, et
 * facturer une matrice complète à chaque affichage n'aurait aucun sens. La vérification
 * qui fait autorité reste celle du moteur au moment de l'affectation.
 */

const VISIBLE = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

export type PlannedJob = {
  id: string;
  reference: string;
  start: Date;
  end: Date;
  durationMin: number;
  status: string;
  customerName: string;
  serviceName: string;
  city: string;
  addressLine1: string;
  totalCents: number;
  /** Trajet estimé depuis le rendez-vous précédent (ou le domicile). */
  travelFromPreviousMin: number;
  /** Minutes de battement une fois le trajet et la marge déduits. Négatif = conflit. */
  slackMin: number;
  conflict: boolean;
  tight: boolean;
};

export type PlannedOperator = {
  id: string;
  code: string;
  name: string;
  status: string;
  jobs: PlannedJob[];
  revenueCents: number;
  conflicts: number;
};

export async function getDayPlanning(date: Date) {
  const dayStart = startOfLocalDay(date);
  const dayEnd = endOfLocalDay(date);
  const settings = await getAssignmentSettings();

  const operators = await prisma.operator.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { code: "asc" },
    select: {
      id: true, code: true, firstName: true, lastName: true, status: true,
      homeLat: true, homeLng: true,
    },
  });

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledStart: { gte: dayStart, lt: dayEnd },
      status: { in: [...VISIBLE] },
      operatorId: { not: null },
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      customer: { select: { firstName: true, lastName: true, companyName: true } },
      service: { select: { name: true } },
    },
  });

  const rows: PlannedOperator[] = operators.map((operator) => {
    const own = appointments.filter((a) => a.operatorId === operator.id);
    let previous: { lat: number; lng: number; end: Date } | null = null;

    const jobs = own.map((appointment): PlannedJob => {
      const origin = previous ?? { lat: operator.homeLat, lng: operator.homeLng, end: appointment.scheduledStart };
      const leg = estimateLeg(
        { lat: origin.lat, lng: origin.lng },
        { lat: appointment.lat, lng: appointment.lng },
        appointment.scheduledStart,
      );

      const available = previous ? minutesBetween(previous.end, appointment.scheduledStart) : Infinity;
      const slack = available - leg.minutes - settings.travelSafetyMarginMin;

      previous = { lat: appointment.lat, lng: appointment.lng, end: appointment.scheduledEnd };

      return {
        id: appointment.id,
        reference: appointment.reference,
        start: appointment.scheduledStart,
        end: appointment.scheduledEnd,
        durationMin: appointment.durationMin,
        status: appointment.status,
        customerName:
          appointment.customer.companyName ??
          `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim(),
        serviceName: appointment.service.name,
        city: appointment.city,
        addressLine1: appointment.addressLine1,
        totalCents: appointment.totalCents,
        travelFromPreviousMin: leg.minutes,
        slackMin: Number.isFinite(slack) ? Math.round(slack) : 0,
        conflict: Number.isFinite(slack) && slack < 0,
        tight: Number.isFinite(slack) && slack >= 0 && slack < settings.tightMarginMin,
      };
    });

    return {
      id: operator.id,
      code: operator.code,
      name: `${operator.firstName} ${operator.lastName}`,
      status: operator.status,
      jobs,
      revenueCents: jobs.reduce((sum, j) => sum + j.totalCents, 0),
      conflicts: jobs.filter((j) => j.conflict).length,
    };
  });

  return { dayStart, dayEnd, operators: rows, settings };
}
