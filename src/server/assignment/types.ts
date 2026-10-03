import type { LatLng } from "@/lib/providers/geo";

/** Les cinq axes du §4. Les poids sont configurables sans redéploiement. */
export type ScoreAxis =
  | "proximity"
  | "availability"
  | "workload"
  | "revenueBalance"
  | "quality";

export type ScoreWeights = Record<ScoreAxis, number>;

export type AssignmentSettings = {
  weights: ScoreWeights;
  /** §6 — marge de sécurité entre deux rendez-vous, en minutes. */
  travelSafetyMarginMin: number;
  /** En dessous de cette marge restante, le candidat est signalé « marge serrée ». */
  tightMarginMin: number;
  /** Au-delà : élimination pure et simple. */
  maxTravelMin: number;
  /** §39 — largeur de la cohorte comparable pour l'équilibrage du CA. */
  comparableBandMin: number;
  targetJobsPerDay: number;
  candidatesReturned: number;
};

/**
 * Les trois départs de la journée : 8 h 30, 11 h 30, 15 h 00.
 *
 * Une tournée de lavage mobile n'a pas d'horaires à la demi-heure : elle a trois
 * départs, et une prestation qui dure. Proposer un quadrillage plus fin donnerait au
 * client l'illusion d'un choix que l'organisation ne peut pas tenir, et fabriquerait
 * des trous inexploitables entre deux interventions.
 *
 * C'est la grille de référence pour tout le système — réservation en ligne, lavage
 * immédiat, planning. Un créneau hors de cette liste n'existe pas.
 */
export const DAILY_SLOT_MINUTES: readonly number[] = [
  8 * 60 + 30,
  11 * 60 + 30,
  15 * 60,
];

/** « 08:30 », pour l'affichage et les messages. */
export function slotLabel(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export const DEFAULT_ASSIGNMENT_SETTINGS: AssignmentSettings = {
  weights: {
    proximity: 0.4,
    availability: 0.25,
    workload: 0.2,
    revenueBalance: 0.1,
    quality: 0.05,
  },
  travelSafetyMarginMin: 10,
  tightMarginMin: 15,
  maxTravelMin: 45,
  comparableBandMin: 12,
  targetJobsPerDay: 5,
  candidatesReturned: 3,
};

export type WorkingWindow = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
};

/** Un rendez-vous déjà planifié dans la tournée de l'opérateur. */
export type ScheduledJob = {
  id: string;
  start: Date;
  end: Date;
  lat: number;
  lng: number;
  label: string;
};

/**
 * Instantané d'un opérateur au moment du calcul. Le moteur ne lit jamais la base :
 * il reçoit cet objet, ce qui le rend testable et rejouable à l'identique.
 */
export type OperatorStatusSnapshot = "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type OperatorSnapshot = {
  id: string;
  code: string;
  name: string;
  status: OperatorStatusSnapshot;
  home: LatLng;
  homeSectorId: string | null;
  sectorIds: string[];
  serviceIds: string[];
  qualityScore: number;
  targetJobsPerDay: number;
  maxTravelMinOverride: number | null;
  workingHours: WorkingWindow[];
  timeOff: Array<{ start: Date; end: Date }>;
  /** Tournée du jour demandé, triée par heure de début. */
  jobsOnDay: ScheduledJob[];
  revenueTodayCents: number;
  revenueWeekCents: number;
  jobsWeekCount: number;
};

export type AssignmentRequest = {
  address: string;
  lat: number;
  lng: number;
  start: Date;
  durationMin: number;
  serviceId: string;
  sectorId?: string | null;
  excludeOperatorIds?: string[];
};

export type RejectionReason =
  | "EXCLUDED"
  | "SUSPENDED"
  | "SERVICE_NOT_ALLOWED"
  | "OUTSIDE_HOURS"
  | "BREAK"
  | "TIME_OFF"
  | "OVERLAP"
  | "INBOUND_TRAVEL"
  | "OUTBOUND_TRAVEL"
  | "TOO_FAR";

export type Rejection = {
  operatorId: string;
  operatorName: string;
  reason: RejectionReason;
  /** Message lisible par le conseiller : « trajet impossible depuis le RDV de 13h ». */
  detail: string;
};

export type LoadLevel = "LOW" | "MEDIUM" | "HIGH";

export type Candidate = {
  operatorId: string;
  operatorCode: string;
  operatorName: string;
  score: number;
  breakdown: Record<ScoreAxis, { raw: number; weight: number; weighted: number }>;
  /** §39 — false si le candidat est hors de la cohorte comparable. */
  comparable: boolean;
  travelMin: number;
  distanceKm: number;
  etaAt: Date;
  departAt: Date;
  originLabel: string;
  slackBeforeMin: number | null;
  slackAfterMin: number | null;
  jobsToday: number;
  revenueTodayCents: number;
  revenueWeekCents: number;
  fillRate: number;
  loadLevel: LoadLevel;
  flags: string[];
};

export type AssignmentResult = {
  candidates: Candidate[];
  rejected: Rejection[];
  weights: ScoreWeights;
  settings: AssignmentSettings;
  computedAt: Date;
  durationMs: number;
  /** false quand le fournisseur cartographique n'intègre pas le trafic réel. */
  trafficAware: boolean;
};
