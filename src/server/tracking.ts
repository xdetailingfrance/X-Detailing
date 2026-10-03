import { prisma } from "./db";
import { geoProvider, haversineKm } from "@/lib/providers/geo";
import { notificationProvider } from "@/lib/providers/notifications";
import { ARRIVING_SOON_TEMPLATE } from "./notification-templates";
import { raiseAlert } from "./quality/alerts";
import { formatLocalTime } from "./time";

/**
 * Suivi GPS temps réel (§11).
 *
 * « Le GPS ne doit pas fonctionner en permanence : il est activé pour le trajet
 * concerné selon les règles de confidentialité définies. »
 *
 * Ce n'est pas un réglage mais une règle serveur : un ping n'est accepté **que** si le
 * rendez-vous est à l'état `EN_ROUTE` et appartient à l'opérateur qui l'envoie. Dès
 * l'arrivée validée, les positions suivantes sont refusées, quoi que fasse le téléphone.
 */

/** Cadence d'émission côté application opérateur. */
export const PING_INTERVAL_SECONDS = 15;

/** Distance à partir de laquelle on prévient le client (§11). */
export const ARRIVING_RADIUS_M = 400;

/** Retard à partir duquel le central est alerté. */
const LATE_THRESHOLD_MIN = 10;

/**
 * L'ETA n'est pas recalculé à chaque ping : avec un fournisseur facturé à l'appel, une
 * position toutes les 15 secondes coûterait 240 appels par heure et par opérateur.
 */
const ETA_MIN_SECONDS = 60;
const ETA_MIN_METERS = 300;

export type PingInput = {
  appointmentId: string;
  operatorId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  headingDeg?: number | null;
  speedKph?: number | null;
};

export type PingResult =
  | { ok: false; error: string; stopTracking: boolean }
  | {
      ok: true;
      etaAt: string | null;
      remainingKm: number;
      remainingMin: number | null;
      arrivingSoon: boolean;
    };

export async function recordPing(input: PingInput, now = new Date()): Promise<PingResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true, reference: true, operatorId: true, status: true,
      lat: true, lng: true, scheduledStart: true, etaAt: true,
      customer: { select: { firstName: true, phone: true, email: true } },
      operator: { select: { firstName: true } },
    },
  });

  if (!appointment || appointment.operatorId !== input.operatorId) {
    return { ok: false, error: "Rendez-vous inconnu.", stopTracking: true };
  }

  // Le cœur de la règle de confidentialité : hors trajet, aucune position n'est conservée.
  if (appointment.status !== "EN_ROUTE") {
    return {
      ok: false,
      error: "Le suivi ne s'applique qu'au trajet en cours.",
      stopTracking: true,
    };
  }

  const destination = { lat: appointment.lat, lng: appointment.lng };
  const current = { lat: input.lat, lng: input.lng };
  const remainingKm = haversineKm(current, destination);

  const previous = await prisma.trackingPing.findFirst({
    where: { appointmentId: appointment.id },
    orderBy: { at: "desc" },
    select: { lat: true, lng: true, at: true },
  });

  await prisma.trackingPing.create({
    data: {
      appointmentId: appointment.id,
      operatorId: input.operatorId,
      lat: input.lat,
      lng: input.lng,
      accuracyM: input.accuracyM ?? null,
      headingDeg: input.headingDeg ?? null,
      speedKph: input.speedKph ?? null,
      at: now,
    },
  });

  // ── ETA, recalculé avec parcimonie ────────────────────────────────────────
  const movedMeters = previous
    ? haversineKm(current, { lat: previous.lat, lng: previous.lng }) * 1000
    : Infinity;
  const secondsSince = previous ? (now.getTime() - previous.at.getTime()) / 1000 : Infinity;

  let etaAt = appointment.etaAt;
  let remainingMin: number | null = null;

  if (secondsSince >= ETA_MIN_SECONDS || movedMeters >= ETA_MIN_METERS) {
    const matrix = await geoProvider().travelMatrix([current], [destination], now);
    const leg = matrix.legs[0][0];

    if (Number.isFinite(leg.minutes)) {
      remainingMin = leg.minutes;
      etaAt = new Date(now.getTime() + leg.minutes * 60_000);

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          etaAt,
          travelMinEstimate: leg.minutes,
          distanceKmEstimate: leg.km,
        },
      });

      // §11 — « les éventuels retards » remontent au patron, pas seulement au client.
      const lateMin = (etaAt.getTime() - appointment.scheduledStart.getTime()) / 60_000;
      if (lateMin > LATE_THRESHOLD_MIN) {
        await raiseAlert({
          type: "LATE",
          severity: "WARNING",
          title: `Retard prévu — ${appointment.reference}`,
          message:
            `Arrivée estimée à ${formatLocalTime(etaAt)}, soit ${Math.round(lateMin)} min ` +
            `après l'heure prévue (${formatLocalTime(appointment.scheduledStart)}).`,
          appointmentId: appointment.id,
          operatorId: input.operatorId,
        });
      }
    }
  }

  // ── Approche du client (§11) ──────────────────────────────────────────────
  const arrivingSoon = remainingKm * 1000 <= ARRIVING_RADIUS_M;

  if (arrivingSoon) {
    const alreadyWarned = await prisma.appointmentEvent.findFirst({
      where: { appointmentId: appointment.id, type: "NOTE", note: { startsWith: "Approche" } },
      select: { id: true },
    });

    if (!alreadyWarned) {
      await prisma.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          type: "NOTE",
          operatorId: input.operatorId,
          note: `Approche signalée au client (${Math.round(remainingKm * 1000)} m)`,
        },
      });

      await notificationProvider().send({
        channel: appointment.customer.email ? "EMAIL" : "SMS",
        recipient: appointment.customer.email ?? appointment.customer.phone,
        template: ARRIVING_SOON_TEMPLATE,
        payload: {
          prenom: appointment.customer.firstName,
          operateur: appointment.operator?.firstName ?? null,
          reference: appointment.reference,
        },
      });
    }
  }

  return {
    ok: true,
    etaAt: etaAt?.toISOString() ?? null,
    remainingKm: Math.round(remainingKm * 10) / 10,
    remainingMin,
    arrivingSoon,
  };
}

// ─── Lecture côté client ─────────────────────────────────────────────────────

export type ClientTracking = {
  status: string;
  /** Prénom seul : le client n'a pas à connaître l'identité complète de l'opérateur (§31). */
  operatorFirstName: string | null;
  /** `null` hors trajet — la position n'est jamais exposée en dehors (§11, §31). */
  position: { lat: number; lng: number; at: string } | null;
  destination: { lat: number; lng: number };
  etaAt: string | null;
  remainingKm: number | null;
  arrivingSoon: boolean;
};

export async function getClientTracking(token: string): Promise<ClientTracking | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { publicToken: token },
    select: {
      status: true, lat: true, lng: true, etaAt: true,
      operator: { select: { firstName: true } },
    },
  });

  if (!appointment) return null;

  const live = appointment.status === "EN_ROUTE";

  const ping = live
    ? await prisma.trackingPing.findFirst({
        where: { appointment: { publicToken: token } },
        orderBy: { at: "desc" },
        select: { lat: true, lng: true, at: true },
      })
    : null;

  const remainingKm = ping
    ? Math.round(haversineKm(ping, { lat: appointment.lat, lng: appointment.lng }) * 10) / 10
    : null;

  return {
    status: appointment.status,
    operatorFirstName: appointment.operator?.firstName ?? null,
    position: ping ? { lat: ping.lat, lng: ping.lng, at: ping.at.toISOString() } : null,
    destination: { lat: appointment.lat, lng: appointment.lng },
    etaAt: live ? (appointment.etaAt?.toISOString() ?? null) : null,
    remainingKm,
    arrivingSoon: remainingKm !== null && remainingKm * 1000 <= ARRIVING_RADIUS_M,
  };
}

// ─── Lecture côté central (§20 — carte live du réseau) ───────────────────────

export type NetworkTracking = {
  at: string;
  operators: Array<{
    operatorId: string;
    code: string;
    name: string;
    status: string;
    position: { lat: number; lng: number; at: string } | null;
    current: {
      appointmentId: string;
      reference: string;
      customer: string;
      city: string;
      lat: number;
      lng: number;
      scheduledStart: string;
      etaAt: string | null;
      lateMin: number | null;
    } | null;
    next: { reference: string; scheduledStart: string; city: string } | null;
  }>;
};

/**
 * Priorité d'affichage quand un opérateur a plusieurs prestations ouvertes.
 *
 * Le cas se produit vraiment : une prestation du matin bloquée à l'encaissement (écart de
 * caisse) reste ouverte pendant que l'opérateur part déjà sur la suivante. Prendre
 * simplement la première de la journée afficherait la mauvaise au patron.
 *
 * Ce qui compte pour la carte est là où se trouve l'opérateur : le trajet d'abord, puis
 * la prestation en cours, et seulement ensuite un encaissement qui traîne.
 */
const ACTIVITY_RANK: Record<string, number> = {
  EN_ROUTE: 0,
  ARRIVED: 1,
  PHOTOS_BEFORE: 1,
  IN_PROGRESS: 1,
  PHOTOS_AFTER: 1,
  PAYMENT: 2,
};

export async function getNetworkTracking(now = new Date()): Promise<NetworkTracking> {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);

  const operators = await prisma.operator.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: {
      id: true, code: true, firstName: true, lastName: true, homeLat: true, homeLng: true,
      appointments: {
        where: { scheduledStart: { gte: dayStart, lt: dayEnd }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        orderBy: { scheduledStart: "asc" },
        select: {
          id: true, reference: true, status: true, city: true, lat: true, lng: true,
          scheduledStart: true, etaAt: true,
          customer: { select: { firstName: true, lastName: true, companyName: true } },
        },
      },
    },
  });

  const enRouteIds = operators
    .flatMap((o) => o.appointments)
    .filter((a) => a.status === "EN_ROUTE")
    .map((a) => a.id);

  // Une seule requête pour toutes les dernières positions, plutôt qu'une par opérateur.
  const pings = enRouteIds.length
    ? await prisma.trackingPing.findMany({
        where: { appointmentId: { in: enRouteIds } },
        orderBy: { at: "desc" },
        select: { appointmentId: true, lat: true, lng: true, at: true },
      })
    : [];

  const latestByAppointment = new Map<string, (typeof pings)[number]>();
  for (const ping of pings) {
    if (!latestByAppointment.has(ping.appointmentId)) latestByAppointment.set(ping.appointmentId, ping);
  }

  return {
    at: now.toISOString(),
    operators: operators.map((operator) => {
      const active = operator.appointments
        .filter((a) => a.status in ACTIVITY_RANK)
        .sort(
          (a, b) =>
            ACTIVITY_RANK[a.status] - ACTIVITY_RANK[b.status] ||
            a.scheduledStart.getTime() - b.scheduledStart.getTime(),
        )
        .at(0);
      const upcoming = operator.appointments.find(
        (a) => a.scheduledStart > now && a.id !== active?.id,
      );
      const ping = active ? latestByAppointment.get(active.id) : undefined;

      return {
        operatorId: operator.id,
        code: operator.code,
        name: `${operator.firstName} ${operator.lastName}`,
        status: active?.status ?? "IDLE",
        position: ping
          ? { lat: ping.lat, lng: ping.lng, at: ping.at.toISOString() }
          : // Hors trajet, le patron voit le point de rattachement, pas une position
            // réelle : le GPS ne tourne pas (§11, §31).
            { lat: operator.homeLat, lng: operator.homeLng, at: now.toISOString() },
        current: active
          ? {
              appointmentId: active.id,
              reference: active.reference,
              customer:
                active.customer.companyName ??
                `${active.customer.firstName ?? ""} ${active.customer.lastName ?? ""}`.trim(),
              city: active.city,
              lat: active.lat,
              lng: active.lng,
              scheduledStart: active.scheduledStart.toISOString(),
              etaAt: active.etaAt?.toISOString() ?? null,
              lateMin: active.etaAt
                ? Math.round((active.etaAt.getTime() - active.scheduledStart.getTime()) / 60_000)
                : null,
            }
          : null,
        next: upcoming
          ? {
              reference: upcoming.reference,
              scheduledStart: upcoming.scheduledStart.toISOString(),
              city: upcoming.city,
            }
          : null,
      };
    }),
  };
}

/** §31 — politique de conservation : les traces de déplacement ne sont pas éternelles. */
export async function purgeOldPings(retentionDays = Number(process.env.TRACKING_RETENTION_DAYS ?? 30)) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 3600_000);
  const { count } = await prisma.trackingPing.deleteMany({ where: { at: { lt: cutoff } } });
  return { deleted: count, cutoff };
}
