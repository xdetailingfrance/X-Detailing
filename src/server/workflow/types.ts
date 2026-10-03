import type { AppointmentStatus, PhotoPhase, PhotoSlot } from "@/generated/prisma/enums";

/**
 * Workflow opérateur verrouillé (§12).
 *
 * « Le workflow doit être strict et impossible à contourner. » Masquer un bouton ne
 * verrouille rien : toute transition passe par une garde serveur, dans une transaction.
 */

export type Transition =
  | "START_TRIP"
  | "ARRIVE"
  | "VALIDATE_PHOTOS_BEFORE"
  | "START_SERVICE"
  | "VALIDATE_PHOTOS_AFTER"
  | "OPEN_PAYMENT"
  | "COMPLETE"
  | "CANCEL"
  | "NO_SHOW"
  /// §36 — prestation réalisée, client refusant de régler.
  | "MARK_UNPAID";

/**
 * Les huit angles exigés à l'arrivée comme au départ (§13, §15).
 *
 * L'ordre est celui du tour du véhicule : on part de l'avant gauche, on longe le côté
 * gauche, on passe derrière, on remonte par la droite, puis on ouvre. Photographier
 * dans l'ordre où l'on marche évite d'oublier une face.
 *
 * Seize photos par prestation, c'est du temps sur place — mais c'est précisément ce qui
 * rend un litige sur une rayure indiscutable, et le §36 s'appuie dessus.
 */
export const REQUIRED_SLOTS: PhotoSlot[] = [
  "FRONT_LEFT",
  "SIDE_LEFT",
  "REAR",
  "SIDE_RIGHT",
  "FRONT_RIGHT",
  "INTERIOR",
  "INTERIOR_REAR",
  "TRUNK",
];

export const SLOT_LABEL: Record<PhotoSlot, string> = {
  FRONT_LEFT: "avant gauche",
  SIDE_LEFT: "flanc gauche",
  REAR: "arrière",
  SIDE_RIGHT: "flanc droit",
  FRONT_RIGHT: "avant droit",
  INTERIOR: "intérieur avant",
  INTERIOR_REAR: "intérieur arrière",
  TRUNK: "coffre",
  EXTRA: "complément",
  DAMAGE: "dommage constaté",
};

/** État minimal nécessaire pour juger une transition. Aucune dépendance à Prisma. */
export type WorkflowSnapshot = {
  id: string;
  reference: string;
  status: AppointmentStatus;
  operatorId: string | null;
  scheduledStart: Date;
  totalCents: number;
  arrivedAt: Date | null;
  startedAt: Date | null;
  photos: Array<{ phase: PhotoPhase; slot: PhotoSlot }>;
  /** §32 — la signature du client conditionne le démarrage. */
  hasSignature: boolean;
  /** §31 — un changement de catégorie doit être accepté avant de commencer. */
  pendingAdjustment: boolean;
  payments: Array<{
    status: string;
    amountCents: number;
    receivedCents: number | null;
    discrepancyCents: number;
  }>;
};

export type GuardFailure = {
  ok: false;
  /** Message destiné à l'opérateur, dans son application. Jamais une trace technique. */
  message: string;
  code:
    | "WRONG_STATE"
    | "NOT_ASSIGNED"
    | "TOO_EARLY"
    | "PHOTOS_MISSING"
    | "PAYMENT_INCOMPLETE"
    | "CASH_MISMATCH"
    | "SIGNATURE_MISSING"
    | "ADJUSTMENT_PENDING"
    | "PROOF_MISSING";
};

export type GuardSuccess = { ok: true; nextStatus: AppointmentStatus };
export type GuardResult = GuardSuccess | GuardFailure;
