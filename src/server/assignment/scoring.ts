import type {
  AssignmentSettings,
  Candidate,
  LoadLevel,
  OperatorSnapshot,
  ScoreAxis,
  ScoreWeights,
} from "./types";

/**
 * Score pondéré (§4) et garde-fou anti-détour (§4, §39).
 *
 * Fonction pure : mêmes entrées, même classement. Le résultat est archivé dans
 * `AssignmentRun` et donc rejouable à l'identique lors d'un audit.
 */

export type FeasibleRow = {
  operator: OperatorSnapshot;
  travelMin: number;
  distanceKm: number;
  departAt: Date;
  etaAt: Date;
  originLabel: string;
  slackBeforeMin: number | null;
  slackAfterMin: number | null;
  jobsToday: number;
  sectorMatch: boolean;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function loadLevel(fillRate: number): LoadLevel {
  if (fillRate < 0.5) return "LOW";
  if (fillRate < 0.85) return "MEDIUM";
  return "HIGH";
}

/**
 * Confort des marges : un rendez-vous qui tient à 2 minutes près est faisable mais
 * fragile. Au-delà de `tightMarginMin × 2` de marge des deux côtés, le confort est
 * maximal. Une absence de voisin compte comme un confort maximal.
 */
function availabilityScore(
  slackBeforeMin: number | null,
  slackAfterMin: number | null,
  settings: AssignmentSettings,
): number {
  const cap = Math.max(1, settings.tightMarginMin * 2);
  const before = slackBeforeMin ?? cap;
  const after = slackAfterMin ?? cap;
  return clamp01(Math.min(before, after, cap) / cap);
}

/**
 * Équilibrage du CA (§5) : normalisation sur l'amplitude observée **parmi les candidats
 * de cette recherche**, jamais sur tout le réseau — comparer un opérateur de Lyon à un
 * opérateur de Marseille n'a aucun sens pour ce rendez-vous.
 *
 * L'amplitude (et non le rang) est utilisée à dessein : un écart de 20 € et un écart de
 * 600 € ne doivent pas peser pareil.
 */
function revenueBalanceScores(rows: FeasibleRow[]): number[] {
  const values = rows.map((r) => r.operator.revenueWeekCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return rows.map(() => 1);
  return values.map((v) => 1 - (v - min) / (max - min));
}

/**
 * §39 — cohorte comparable.
 *
 * Sans cette règle, 30 % de poids cumulés sur charge + CA suffiraient à faire gagner un
 * opérateur à 45 min contre un opérateur à 10 min. Le garde-fou est donc structurel :
 * hors de la bande de comparabilité, les axes `workload` et `revenueBalance` sont
 * neutralisés et leur poids est reversé sur `proximity`.
 */
function effectiveWeights(comparable: boolean, weights: ScoreWeights): ScoreWeights {
  if (comparable) return weights;
  return {
    ...weights,
    proximity: weights.proximity + weights.workload + weights.revenueBalance,
    workload: 0,
    revenueBalance: 0,
  };
}

export function scoreCandidates(
  rows: FeasibleRow[],
  settings: AssignmentSettings,
): Candidate[] {
  if (rows.length === 0) return [];

  const bestTravel = Math.min(...rows.map((r) => r.travelMin));
  const balance = revenueBalanceScores(rows);

  const candidates = rows.map((row, index): Candidate => {
    const { operator } = row;
    const comparable = row.travelMin <= bestTravel + settings.comparableBandMin;
    const weights = effectiveWeights(comparable, settings.weights);

    const target = operator.targetJobsPerDay || settings.targetJobsPerDay;
    const fillRate = target > 0 ? row.jobsToday / target : 0;

    const raw: Record<ScoreAxis, number> = {
      proximity: clamp01(1 - row.travelMin / settings.maxTravelMin),
      availability: availabilityScore(row.slackBeforeMin, row.slackAfterMin, settings),
      workload: clamp01(1 - fillRate),
      revenueBalance: balance[index],
      quality: clamp01(operator.qualityScore / 100),
    };

    const breakdown = {} as Candidate["breakdown"];
    let total = 0;
    for (const axis of Object.keys(raw) as ScoreAxis[]) {
      const weight = weights[axis];
      const weighted = raw[axis] * weight;
      breakdown[axis] = {
        raw: Math.round(raw[axis] * 1000) / 1000,
        weight,
        weighted: Math.round(weighted * 1000) / 1000,
      };
      total += weighted;
    }

    const flags: string[] = [];
    const tightest = Math.min(
      row.slackBeforeMin ?? Number.POSITIVE_INFINITY,
      row.slackAfterMin ?? Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(tightest) && tightest < settings.tightMarginMin) {
      flags.push(`marge serrée (${Math.round(tightest)} min)`);
    }
    if (!row.sectorMatch) flags.push("hors secteur habituel");
    if (!comparable) flags.push(`trajet +${Math.round(row.travelMin - bestTravel)} min vs meilleur`);
    if (fillRate >= 1) flags.push("journée déjà pleine");

    return {
      operatorId: operator.id,
      operatorCode: operator.code,
      operatorName: operator.name,
      score: Math.round(total * 100),
      breakdown,
      comparable,
      travelMin: Math.round(row.travelMin),
      distanceKm: Math.round(row.distanceKm * 10) / 10,
      etaAt: row.etaAt,
      departAt: row.departAt,
      originLabel: row.originLabel,
      slackBeforeMin: row.slackBeforeMin === null ? null : Math.round(row.slackBeforeMin),
      slackAfterMin: row.slackAfterMin === null ? null : Math.round(row.slackAfterMin),
      jobsToday: row.jobsToday,
      revenueTodayCents: operator.revenueTodayCents,
      revenueWeekCents: operator.revenueWeekCents,
      fillRate: Math.round(fillRate * 100) / 100,
      loadLevel: loadLevel(fillRate),
      flags,
    };
  });

  // Départage déterministe : à score égal, le trajet le plus court, puis le code
  // opérateur — pour qu'une même recherche rende toujours le même classement.
  return candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.travelMin - b.travelMin ||
      a.operatorCode.localeCompare(b.operatorCode),
  );
}
