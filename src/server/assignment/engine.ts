import type { GeoProvider, LatLng } from "@/lib/providers/geo";
import { formatLocalTime } from "@/server/time";
import { checkSchedule, checkTravel, type Neighbours } from "./constraints";
import { scoreCandidates, type FeasibleRow } from "./scoring";
import type {
  AssignmentRequest,
  AssignmentResult,
  AssignmentSettings,
  OperatorSnapshot,
  Rejection,
} from "./types";

export * from "./types";
export { scoreCandidates } from "./scoring";
export { checkSchedule, checkTravel } from "./constraints";

/**
 * « TROUVER LE MEILLEUR OPÉRATEUR » — §35, la fonction centrale du projet.
 *
 * Aucun accès à la base, aucun effet de bord : le moteur reçoit un instantané du réseau
 * et retourne un classement. C'est ce qui le rend testable, rejouable et auditable.
 *
 * Deux appels cartographiques au total, quel que soit le nombre d'opérateurs (§33) :
 * un pour les trajets entrants, un pour les trajets sortants.
 */
export async function findBestOperators(input: {
  request: AssignmentRequest;
  operators: OperatorSnapshot[];
  settings: AssignmentSettings;
  geo: GeoProvider;
}): Promise<AssignmentResult> {
  const startedAt = Date.now();
  const { request, operators, settings, geo } = input;

  const target: LatLng = { lat: request.lat, lng: request.lng };
  const requestEnd = new Date(request.start.getTime() + request.durationMin * 60_000);

  const rejected: Rejection[] = [];
  const survivors: Array<{
    operator: OperatorSnapshot;
    neighbours: Neighbours;
    windowStartMinute: number;
  }> = [];

  // ── Étape 1 : contraintes vérifiables sans temps de trajet ──────────────────
  for (const operator of operators) {
    const check = checkSchedule(operator, request);
    if (!check.ok) {
      rejected.push({
        operatorId: operator.id,
        operatorName: operator.name,
        reason: check.reason,
        detail: check.detail,
      });
      continue;
    }
    survivors.push({
      operator,
      neighbours: check.neighbours,
      windowStartMinute: check.windowStartMinute,
    });
  }

  if (survivors.length === 0) {
    return {
      candidates: [],
      rejected,
      weights: settings.weights,
      settings,
      computedAt: new Date(),
      durationMs: Date.now() - startedAt,
      trafficAware: geo.trafficAware,
    };
  }

  // ── Étape 2 : une seule matrice pour tous les trajets entrants ──────────────
  // L'origine est le rendez-vous précédent réel, ou le domicile à défaut (§4).
  const origins: LatLng[] = survivors.map(({ operator, neighbours }) =>
    neighbours.previous
      ? { lat: neighbours.previous.lat, lng: neighbours.previous.lng }
      : operator.home,
  );

  const inbound = await geo.travelMatrix(origins, [target], request.start);

  // ── Une seule matrice pour tous les trajets sortants ────────────────────────
  const withNext = survivors
    .map((s, index) => ({ index, next: s.neighbours.next }))
    .filter((s): s is { index: number; next: NonNullable<Neighbours["next"]> } => s.next !== null);

  const outbound =
    withNext.length > 0
      ? await geo.travelMatrix(
          [target],
          withNext.map((s) => ({ lat: s.next.lat, lng: s.next.lng })),
          requestEnd,
        )
      : null;

  const outboundByIndex = new Map<number, number>();
  withNext.forEach((s, position) => {
    outboundByIndex.set(s.index, outbound!.legs[0][position].minutes);
  });

  // ── Étape 3 : contraintes de trajet ────────────────────────────────────────
  const feasible: FeasibleRow[] = [];

  survivors.forEach((survivor, index) => {
    const { operator, neighbours, windowStartMinute } = survivor;
    const leg = inbound.legs[index][0];
    const maxTravelMin = operator.maxTravelMinOverride ?? settings.maxTravelMin;

    const travel = checkTravel({
      request,
      neighbours,
      windowStartMinute,
      inboundMin: leg.minutes,
      outboundMin: outboundByIndex.get(index) ?? null,
      safetyMarginMin: settings.travelSafetyMarginMin,
      maxTravelMin,
    });

    if (!travel.ok) {
      rejected.push({
        operatorId: operator.id,
        operatorName: operator.name,
        reason: travel.reason,
        detail: travel.detail,
      });
      return;
    }

    feasible.push({
      operator,
      travelMin: leg.minutes,
      distanceKm: leg.km,
      departAt: travel.departAt,
      etaAt: request.start,
      originLabel: neighbours.previous
        ? `depuis le RDV de ${formatLocalTime(neighbours.previous.end)} — ${neighbours.previous.label}`
        : "depuis le domicile",
      slackBeforeMin: travel.slackBeforeMin,
      slackAfterMin: travel.slackAfterMin,
      jobsToday: operator.jobsOnDay.length,
      sectorMatch: request.sectorId ? operator.sectorIds.includes(request.sectorId) : true,
    });
  });

  // ── Étape 4 : score + garde-fou anti-détour ────────────────────────────────
  const ranked = scoreCandidates(feasible, settings);

  return {
    candidates: ranked.slice(0, settings.candidatesReturned),
    rejected,
    weights: settings.weights,
    settings,
    computedAt: new Date(),
    durationMs: Date.now() - startedAt,
    trafficAware: geo.trafficAware,
  };
}
