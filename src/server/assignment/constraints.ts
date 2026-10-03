import { formatMinutes, formatLocalTime, minutesBetween, zonedParts } from "@/server/time";
import type {
  AssignmentRequest,
  OperatorSnapshot,
  RejectionReason,
  ScheduledJob,
} from "./types";

/**
 * Contraintes dures (§4, §6).
 *
 * Un opérateur écarté l'est toujours avec un motif lisible : le back-office doit pouvoir
 * répondre « pourquoi personne n'est disponible à 14h ? » sans lire les logs.
 */

export type Neighbours = {
  previous: ScheduledJob | null;
  next: ScheduledJob | null;
};

export type ScheduleFailure = { ok: false; reason: RejectionReason; detail: string };
export type ScheduleSuccess = { ok: true; neighbours: Neighbours; windowStartMinute: number };
export type ScheduleCheck = ScheduleSuccess | ScheduleFailure;

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Contraintes 1 à 6 : tout ce qui se vérifie sans connaître les temps de trajet.
 * Évalué en premier pour ne calculer une matrice que sur les opérateurs survivants (§33).
 */
export function checkSchedule(
  operator: OperatorSnapshot,
  request: AssignmentRequest,
): ScheduleCheck {
  const end = new Date(request.start.getTime() + request.durationMin * 60_000);

  if (request.excludeOperatorIds?.includes(operator.id)) {
    return { ok: false, reason: "EXCLUDED", detail: "exclu de cette recherche" };
  }

  if (operator.status !== "ACTIVE") {
    return {
      ok: false,
      reason: "SUSPENDED",
      detail: operator.status === "SUSPENDED" ? "opérateur suspendu" : "opérateur non actif",
    };
  }

  if (!operator.serviceIds.includes(request.serviceId)) {
    return {
      ok: false,
      reason: "SERVICE_NOT_ALLOWED",
      detail: "prestation non autorisée pour cet opérateur",
    };
  }

  const { weekday, minutes: startMinute } = zonedParts(request.start);
  const endMinute = startMinute + request.durationMin;

  const window = operator.workingHours.find((w) => w.weekday === weekday);
  if (!window) {
    return { ok: false, reason: "OUTSIDE_HOURS", detail: "ne travaille pas ce jour" };
  }

  if (startMinute < window.startMinute || endMinute > window.endMinute) {
    return {
      ok: false,
      reason: "OUTSIDE_HOURS",
      detail: `horaires ${formatMinutes(window.startMinute)}–${formatMinutes(window.endMinute)}`,
    };
  }

  if (
    window.breakStartMinute !== null &&
    window.breakEndMinute !== null &&
    startMinute < window.breakEndMinute &&
    window.breakStartMinute < endMinute
  ) {
    return {
      ok: false,
      reason: "BREAK",
      detail: `pause ${formatMinutes(window.breakStartMinute)}–${formatMinutes(window.breakEndMinute)}`,
    };
  }

  const absence = operator.timeOff.find((t) => overlaps(request.start, end, t.start, t.end));
  if (absence) {
    return { ok: false, reason: "TIME_OFF", detail: "absent / congé" };
  }

  const clash = operator.jobsOnDay.find((j) => overlaps(request.start, end, j.start, j.end));
  if (clash) {
    return {
      ok: false,
      reason: "OVERLAP",
      detail: `déjà occupé à ${formatLocalTime(clash.start)} (${clash.label})`,
    };
  }

  // La tournée est triée : le précédent est le dernier RDV qui se termine avant le début
  // demandé, le suivant le premier qui commence après la fin demandée.
  let previous: ScheduledJob | null = null;
  let next: ScheduledJob | null = null;

  for (const job of operator.jobsOnDay) {
    if (job.end <= request.start) previous = job;
    else if (job.start >= end && next === null) next = job;
  }

  return { ok: true, neighbours: { previous, next }, windowStartMinute: window.startMinute };
}

export type TravelCheckInput = {
  request: AssignmentRequest;
  neighbours: Neighbours;
  windowStartMinute: number;
  /** Trajet depuis le point d'origine (RDV précédent ou domicile) vers le client. */
  inboundMin: number;
  /** Trajet du client vers le RDV suivant. `null` s'il n'y en a pas. */
  outboundMin: number | null;
  safetyMarginMin: number;
  maxTravelMin: number;
};

export type TravelFailure = { ok: false; reason: RejectionReason; detail: string };
export type TravelSuccess = {
  ok: true;
  slackBeforeMin: number | null;
  slackAfterMin: number | null;
  departAt: Date;
};

/**
 * Contraintes 7 à 9 — le cœur du §6.
 *
 * Le point de départ est le **rendez-vous précédent réel**, pas le domicile : c'est la
 * différence explicitement demandée par le §4.
 */
export function checkTravel(input: TravelCheckInput): TravelSuccess | TravelFailure {
  const { request, neighbours, inboundMin, outboundMin, safetyMarginMin, maxTravelMin } = input;
  const end = new Date(request.start.getTime() + request.durationMin * 60_000);

  if (inboundMin > maxTravelMin) {
    return {
      ok: false,
      reason: "TOO_FAR",
      detail: `trop loin (${Math.round(inboundMin)} min, plafond ${maxTravelMin} min)`,
    };
  }

  const departAt = new Date(request.start.getTime() - inboundMin * 60_000);

  let slackBeforeMin: number | null = null;
  if (neighbours.previous) {
    const earliestArrival = new Date(
      neighbours.previous.end.getTime() + (inboundMin + safetyMarginMin) * 60_000,
    );
    slackBeforeMin = minutesBetween(neighbours.previous.end, request.start) - inboundMin - safetyMarginMin;

    if (earliestArrival > request.start) {
      return {
        ok: false,
        reason: "INBOUND_TRAVEL",
        detail:
          `trajet impossible depuis le RDV de ${formatLocalTime(neighbours.previous.end)} ` +
          `(${Math.round(inboundMin)} min + ${safetyMarginMin} min de marge, ` +
          `manque ${Math.abs(Math.round(slackBeforeMin))} min)`,
      };
    }
  } else {
    // Sans RDV précédent, le départ se fait du domicile : il ne peut pas précéder
    // le début de la journée de travail.
    const departMinute = zonedParts(departAt).minutes;
    if (departMinute < input.windowStartMinute) {
      return {
        ok: false,
        reason: "OUTSIDE_HOURS",
        detail: `devrait partir à ${formatMinutes(departMinute)}, avant le début de journée`,
      };
    }
  }

  let slackAfterMin: number | null = null;
  if (neighbours.next && outboundMin !== null) {
    slackAfterMin = minutesBetween(end, neighbours.next.start) - outboundMin - safetyMarginMin;

    if (slackAfterMin < 0) {
      return {
        ok: false,
        reason: "OUTBOUND_TRAVEL",
        detail:
          `mettrait en retard le RDV de ${formatLocalTime(neighbours.next.start)} ` +
          `(${Math.round(outboundMin)} min de trajet, manque ${Math.abs(Math.round(slackAfterMin))} min)`,
      };
    }
  }

  return { ok: true, slackBeforeMin, slackAfterMin, departAt };
}
