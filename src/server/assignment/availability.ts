import { geoProvider, type LatLng } from "@/lib/providers/geo";
import { getAssignmentSettings } from "../settings";
import { startOfLocalDay, zonedParts } from "../time";
import { checkSchedule, checkTravel } from "./constraints";
import { scoreCandidates, type FeasibleRow } from "./scoring";
import { loadOperatorSnapshots } from "./snapshot";
import { DAILY_SLOT_MINUTES, type AssignmentRequest } from "./types";

/**
 * Créneaux réellement disponibles pour une adresse donnée (§2).
 *
 * « Créneaux disponibles calculés selon les vrais temps de trajet et non simplement selon
 * la position théorique d'un opérateur. » Chaque créneau proposé au client a donc été
 * validé contre la tournée réelle de chaque opérateur, trajet amont et aval compris.
 *
 * Coût cartographique : **deux appels pour toute la journée**, quel que soit le nombre de
 * créneaux et d'opérateurs. L'ensemble des points d'origine possibles (domiciles +
 * rendez-vous déjà planifiés) ne dépend pas du créneau testé : on calcule la matrice une
 * fois, puis chaque créneau n'est plus qu'une lecture dans une table.
 *
 * Compromis assumé : la matrice est calculée pour une heure de référence unique (midi).
 * Avec un fournisseur sensible au trafic, un créneau de 18h peut donc être légèrement
 * optimiste. La validation qui fait autorité est celle du moteur complet, rejouée à
 * l'heure exacte au moment de la confirmation.
 */

export type SlotOption = {
  start: string;
  end: string;
  /** Heure locale « 14:30 », prête à afficher. */
  label: string;
  bestScore: number;
  /** Nombre d'opérateurs capables de prendre ce créneau. */
  operatorCount: number;
  travelMin: number;
};

export type AvailabilityResult = {
  slots: SlotOption[];
  slotsTested: number;
  operatorsConsidered: number;
  trafficAware: boolean;
  durationMs: number;
};

export type AvailabilityInput = {
  lat: number;
  lng: number;
  address: string;
  day: Date;
  durationMin: number;
  serviceId: string;
  sectorId?: string | null;
  /** Délai minimum entre maintenant et le début d'un créneau. */
  leadTimeMin?: number;
  now?: Date;
};

const pointKey = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export async function findAvailableSlots(input: AvailabilityInput): Promise<AvailabilityResult> {
  const startedAt = Date.now();
  const {
    lat, lng, address, day, durationMin, serviceId,
    leadTimeMin = 120, now = new Date(),
  } = input;

  const settings = await getAssignmentSettings();
  const operators = await loadOperatorSnapshots(day, { activeOnly: true });
  const geo = geoProvider();
  const target: LatLng = { lat, lng };

  const empty: AvailabilityResult = {
    slots: [], slotsTested: 0, operatorsConsidered: operators.length,
    trafficAware: geo.trafficAware, durationMs: Date.now() - startedAt,
  };
  if (operators.length === 0) return empty;

  const dayStart = startOfLocalDay(day);
  const weekday = zonedParts(dayStart).weekday;

  // Amplitude de la journée : union des horaires de tous les opérateurs ce jour-là.
  const windows = operators.flatMap((o) => o.workingHours.filter((w) => w.weekday === weekday));
  if (windows.length === 0) return empty;

  const openMinute = Math.min(...windows.map((w) => w.startMinute));
  const closeMinute = Math.max(...windows.map((w) => w.endMinute));

  // ── Une seule matrice pour tous les points d'origine possibles ──────────────
  const points = new Map<string, LatLng>();
  for (const operator of operators) {
    points.set(pointKey(operator.home), operator.home);
    for (const job of operator.jobsOnDay) {
      const p = { lat: job.lat, lng: job.lng };
      points.set(pointKey(p), p);
    }
  }

  const pointList = [...points.values()];
  const referenceTime = new Date(dayStart.getTime() + 12 * 3600_000);

  const [inbound, outbound] = await Promise.all([
    geo.travelMatrix(pointList, [target], referenceTime),
    geo.travelMatrix([target], pointList, referenceTime),
  ]);

  const indexOf = new Map([...points.keys()].map((key, index) => [key, index]));
  const legTo = (from: LatLng) => inbound.legs[indexOf.get(pointKey(from))!][0];
  const minutesFrom = (to: LatLng) => outbound.legs[0][indexOf.get(pointKey(to))!].minutes;

  // ── Chaque créneau n'est plus qu'une lecture dans la table ─────────────────
  const slots: SlotOption[] = [];
  const earliest = new Date(now.getTime() + leadTimeMin * 60_000);
  let slotsTested = 0;

  // Trois départs par jour, pas un quadrillage (§2). On ne retient que ceux qui
  // tiennent dans l'amplitude d'ouverture du réseau ce jour-là.
  for (const minute of DAILY_SLOT_MINUTES) {
    if (minute < openMinute || minute + durationMin > closeMinute) continue;

    const start = new Date(dayStart.getTime() + minute * 60_000);
    if (start < earliest) continue;
    slotsTested += 1;

    const request: AssignmentRequest = {
      address, lat, lng, start, durationMin, serviceId, sectorId: input.sectorId,
    };

    const feasible: FeasibleRow[] = [];

    for (const operator of operators) {
      const schedule = checkSchedule(operator, request);
      if (!schedule.ok) continue;

      const { previous, next } = schedule.neighbours;
      const origin = previous ? { lat: previous.lat, lng: previous.lng } : operator.home;
      const leg = legTo(origin);

      const travel = checkTravel({
        request,
        neighbours: schedule.neighbours,
        windowStartMinute: schedule.windowStartMinute,
        inboundMin: leg.minutes,
        outboundMin: next ? minutesFrom({ lat: next.lat, lng: next.lng }) : null,
        safetyMarginMin: settings.travelSafetyMarginMin,
        maxTravelMin: operator.maxTravelMinOverride ?? settings.maxTravelMin,
      });
      if (!travel.ok) continue;

      feasible.push({
        operator,
        travelMin: leg.minutes,
        distanceKm: leg.km,
        departAt: travel.departAt,
        etaAt: start,
        originLabel: previous ? "depuis un rendez-vous précédent" : "depuis le domicile",
        slackBeforeMin: travel.slackBeforeMin,
        slackAfterMin: travel.slackAfterMin,
        jobsToday: operator.jobsOnDay.length,
        sectorMatch: input.sectorId ? operator.sectorIds.includes(input.sectorId) : true,
      });
    }

    if (feasible.length === 0) continue;

    const [best] = scoreCandidates(feasible, settings);
    slots.push({
      start: start.toISOString(),
      end: new Date(start.getTime() + durationMin * 60_000).toISOString(),
      label: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
      bestScore: best.score,
      operatorCount: feasible.length,
      travelMin: best.travelMin,
    });
  }

  return {
    slots,
    slotsTested,
    operatorsConsidered: operators.length,
    trafficAware: geo.trafficAware,
    durationMs: Date.now() - startedAt,
  };
}
