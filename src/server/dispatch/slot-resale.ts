import { prisma } from "../db";
import { haversineKm } from "@/lib/providers/geo";
import { notificationProvider } from "@/lib/providers/notifications";
import { formatLocalDateTime } from "../time";

/**
 * Revente d'un créneau libéré (§8).
 *
 * « Lorsqu'un rendez-vous est annulé, le créneau libéré doit pouvoir être proposé aux
 * clients proches ou aux clients flexibles. Objectif : réduire les trous dans les
 * agendas et récupérer du CA perdu. »
 *
 * Le créneau n'est **pas** attribué d'office : on identifie des candidats et on leur
 * propose. Déplacer un client sans son accord serait le meilleur moyen de le perdre.
 */

/** Rayon de recherche autour de l'adresse libérée. */
const NEARBY_KM = 8;

/** Nombre de clients sollicités : au-delà, on promet le même créneau à trop de monde. */
const MAX_CANDIDATES = 5;

export type ResaleCandidate = {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  distanceKm: number;
  flexible: boolean;
  lastServiceId: string | null;
  /** Ce qui a fait retenir ce client, pour que le back-office puisse le justifier. */
  reason: string;
};

export type ResaleResult = {
  offerId: string | null;
  candidates: ResaleCandidate[];
  notified: number;
};

/**
 * Identifie les clients susceptibles d'accepter le créneau libéré et leur propose.
 * Appelé après une annulation.
 */
export async function offerFreedSlot(input: {
  cancelledAppointmentId: string;
  now?: Date;
}): Promise<ResaleResult> {
  const now = input.now ?? new Date();

  const cancelled = await prisma.appointment.findUnique({
    where: { id: input.cancelledAppointmentId },
    select: {
      id: true, reference: true, lat: true, lng: true, city: true, sectorId: true,
      scheduledStart: true, scheduledEnd: true, durationMin: true, customerId: true,
      status: true,
      slotOffer: { select: { id: true } },
    },
  });

  if (!cancelled) return { offerId: null, candidates: [], notified: 0 };

  // Un créneau déjà passé ne se revend pas, et on n'en propose qu'une fois.
  if (cancelled.scheduledStart <= now || cancelled.slotOffer) {
    return { offerId: null, candidates: [], notified: 0 };
  }

  // Clients candidats : acceptant le démarchage, sans rendez-vous déjà prévu, et
  // ayant déjà une adresse géocodée — sans quoi on ne peut juger de la proximité.
  const customers = await prisma.customer.findMany({
    where: {
      id: { not: cancelled.customerId },
      marketingOptIn: true,
      addresses: { some: {} },
      appointments: {
        none: {
          scheduledStart: { gt: now },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      },
    },
    select: {
      id: true, firstName: true, lastName: true, companyName: true,
      phone: true, email: true, flexible: true,
      addresses: {
        where: { isDefault: true },
        take: 1,
        select: { lat: true, lng: true },
      },
      appointments: {
        where: { status: "COMPLETED" },
        orderBy: { scheduledStart: "desc" },
        take: 1,
        select: { serviceId: true, scheduledStart: true },
      },
    },
  });

  const candidates: ResaleCandidate[] = [];

  for (const customer of customers) {
    const address = customer.addresses[0];
    if (!address) continue;

    const distanceKm = haversineKm(
      { lat: address.lat, lng: address.lng },
      { lat: cancelled.lat, lng: cancelled.lng },
    );
    if (distanceKm > NEARBY_KM) continue;

    const last = customer.appointments[0];
    const daysSince = last
      ? Math.floor((now.getTime() - last.scheduledStart.getTime()) / 86_400_000)
      : null;

    candidates.push({
      customerId: customer.id,
      name: customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
      phone: customer.phone,
      email: customer.email,
      distanceKm: Math.round(distanceKm * 10) / 10,
      flexible: customer.flexible,
      lastServiceId: last?.serviceId ?? null,
      reason: customer.flexible
        ? "accepte les créneaux de dernière minute"
        : daysSince !== null
          ? `client à ${Math.round(distanceKm * 10) / 10} km, dernier lavage il y a ${daysSince} j`
          : `client à ${Math.round(distanceKm * 10) / 10} km`,
    });
  }

  // Les clients flexibles d'abord, puis les plus proches : ce sont ceux qui ont le plus
  // de chances d'accepter, et les moins coûteux à insérer dans la tournée.
  candidates.sort(
    (a, b) => Number(b.flexible) - Number(a.flexible) || a.distanceKm - b.distanceKm,
  );
  const retained = candidates.slice(0, MAX_CANDIDATES);

  if (retained.length === 0) return { offerId: null, candidates: [], notified: 0 };

  const offer = await prisma.slotOffer.create({
    data: {
      sourceAppointmentId: cancelled.id,
      sectorId: cancelled.sectorId,
      start: cancelled.scheduledStart,
      end: cancelled.scheduledEnd,
      durationMin: cancelled.durationMin,
      status: "SENT",
      candidates: retained as never,
      sentAt: now,
      // Un créneau proposé indéfiniment finit par être accepté trop tard.
      expiresAt: new Date(
        Math.min(
          cancelled.scheduledStart.getTime() - 2 * 3600_000,
          now.getTime() + 12 * 3600_000,
        ),
      ),
    },
    select: { id: true },
  });

  let notified = 0;
  for (const candidate of retained) {
    await notificationProvider().send({
      channel: candidate.email ? "EMAIL" : "SMS",
      recipient: candidate.email ?? candidate.phone,
      template: "creneau_libere",
      payload: {
        creneau: formatLocalDateTime(cancelled.scheduledStart),
        ville: cancelled.city,
        offreId: offer.id,
      },
    });
    notified += 1;
  }

  return { offerId: offer.id, candidates: retained, notified };
}
