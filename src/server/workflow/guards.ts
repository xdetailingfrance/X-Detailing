import type { AppointmentStatus, PhotoPhase } from "@/generated/prisma/enums";
import {
  REQUIRED_SLOTS,
  SLOT_LABEL,
  type GuardResult,
  type Transition,
  type WorkflowSnapshot,
} from "./types";

/**
 * Les gardes du §12, une par une.
 *
 * Fonctions pures : elles ne lisent ni la base ni l'heure système autrement que par
 * l'argument `now`. C'est ce qui les rend testables et ce qui garantit qu'un même état
 * produit toujours la même décision.
 */

/** Combien de temps avant l'heure prévue un opérateur peut démarrer son trajet. */
export const TRIP_LEAD_MINUTES = 180;

function missingSlots(
  photos: WorkflowSnapshot["photos"],
  phase: PhotoPhase,
): string[] {
  const present = new Set(photos.filter((p) => p.phase === phase).map((p) => p.slot));
  return REQUIRED_SLOTS.filter((slot) => !present.has(slot)).map((slot) => SLOT_LABEL[slot]);
}

/** Statuts depuis lesquels un rendez-vous peut encore être annulé (§12). */
const CANCELLABLE: AppointmentStatus[] = [
  "DRAFT", "PENDING_ASSIGNMENT", "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
];

export function checkTransition(
  transition: Transition,
  snapshot: WorkflowSnapshot,
  context: { operatorId: string | null; now: Date },
): GuardResult {
  const { status } = snapshot;

  // Un opérateur n'agit que sur ses propres rendez-vous (§31). `operatorId: null`
  // désigne une action du back-office, qui n'est pas soumise à cette règle.
  if (
    context.operatorId !== null &&
    snapshot.operatorId !== context.operatorId
  ) {
    return {
      ok: false,
      code: "NOT_ASSIGNED",
      message: "Ce rendez-vous n'est pas le vôtre.",
    };
  }

  const wrongState = (expected: string): GuardResult => ({
    ok: false,
    code: "WRONG_STATE",
    message: `Action impossible : le rendez-vous est à l'étape « ${expected} ».`,
  });

  switch (transition) {
    // ── Trajet ────────────────────────────────────────────────────────────
    case "START_TRIP": {
      if (status !== "ASSIGNED" && status !== "CONFIRMED") return wrongState(status);

      const earliest = new Date(
        snapshot.scheduledStart.getTime() - TRIP_LEAD_MINUTES * 60_000,
      );
      if (context.now < earliest) {
        return {
          ok: false,
          code: "TOO_EARLY",
          message: "Trop tôt pour démarrer ce trajet.",
        };
      }
      return { ok: true, nextStatus: "EN_ROUTE" };
    }

    case "ARRIVE": {
      if (status !== "EN_ROUTE") return wrongState(status);
      return { ok: true, nextStatus: "ARRIVED" };
    }

    // ── « Pas d'arrivée validée = pas de photos avant » ────────────────────
    case "VALIDATE_PHOTOS_BEFORE": {
      if (status !== "ARRIVED") return wrongState(status);
      if (!snapshot.arrivedAt) {
        return {
          ok: false,
          code: "WRONG_STATE",
          message: "Validez d'abord votre arrivée sur place.",
        };
      }

      const missing = missingSlots(snapshot.photos, "BEFORE");
      if (missing.length > 0) {
        return {
          ok: false,
          code: "PHOTOS_MISSING",
          message: `${missing.length} photo${missing.length > 1 ? "s" : ""} avant manquante${missing.length > 1 ? "s" : ""} : ${missing.join(", ")}.`,
        };
      }
      return { ok: true, nextStatus: "PHOTOS_BEFORE" };
    }

    // ── « Pas de photos avant validées = pas de démarrage » ────────────────
    //
    // Deux conditions s'ajoutent ici plutôt que sous forme d'étapes séparées : elles
    // portent toutes deux sur l'accord du client avant que le travail commence.
    case "START_SERVICE": {
      if (status !== "PHOTOS_BEFORE") return wrongState(status);

      // §31 — le véhicule ne correspondait pas à la réservation : le nouveau tarif
      // doit être accepté avant de commencer, pas découvert à la facture.
      if (snapshot.pendingAdjustment) {
        return {
          ok: false,
          code: "ADJUSTMENT_PENDING",
          message: "Le client doit d'abord valider le nouveau tarif.",
        };
      }

      // §32 — la signature vaut accord sur la prestation et son montant.
      if (!snapshot.hasSignature) {
        return {
          ok: false,
          code: "SIGNATURE_MISSING",
          message: "Faites signer le client avant de démarrer.",
        };
      }

      return { ok: true, nextStatus: "IN_PROGRESS" };
    }

    // ── « Pas de prestation démarrée = pas de photos après » ───────────────
    case "VALIDATE_PHOTOS_AFTER": {
      if (status !== "IN_PROGRESS") return wrongState(status);
      if (!snapshot.startedAt) {
        return {
          ok: false,
          code: "WRONG_STATE",
          message: "La prestation n'a pas été démarrée.",
        };
      }

      const missing = missingSlots(snapshot.photos, "AFTER");
      if (missing.length > 0) {
        return {
          ok: false,
          code: "PHOTOS_MISSING",
          message: `${missing.length} photo${missing.length > 1 ? "s" : ""} après manquante${missing.length > 1 ? "s" : ""} : ${missing.join(", ")}.`,
        };
      }
      return { ok: true, nextStatus: "PHOTOS_AFTER" };
    }

    // ── « Pas de photos après validées = pas d'encaissement » ──────────────
    case "OPEN_PAYMENT": {
      if (status !== "PHOTOS_AFTER") return wrongState(status);
      return { ok: true, nextStatus: "PAYMENT" };
    }

    // ── « Pas de paiement validé = pas de terminaison » ────────────────────
    case "COMPLETE": {
      if (status !== "PAYMENT") return wrongState(status);

      const paid = snapshot.payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amountCents, 0);

      if (paid < snapshot.totalCents) {
        return {
          ok: false,
          code: "PAYMENT_INCOMPLETE",
          message: `Il reste ${((snapshot.totalCents - paid) / 100).toFixed(2)} € à encaisser.`,
        };
      }

      // §16 : un écart de caisse bloque la clôture, il ne se règle pas sur le terrain.
      const mismatch = snapshot.payments.find((p) => p.discrepancyCents !== 0);
      if (mismatch) {
        return {
          ok: false,
          code: "CASH_MISMATCH",
          message:
            `Écart de caisse de ${(mismatch.discrepancyCents / 100).toFixed(2)} € : ` +
            "le central doit le régulariser avant la clôture.",
        };
      }

      return { ok: true, nextStatus: "COMPLETED" };
    }

    case "CANCEL": {
      if (!CANCELLABLE.includes(status)) {
        return {
          ok: false,
          code: "WRONG_STATE",
          message: "La prestation est démarrée : elle ne peut plus être annulée.",
        };
      }
      return { ok: true, nextStatus: "CANCELLED" };
    }

    case "NO_SHOW": {
      if (status !== "EN_ROUTE" && status !== "ARRIVED") return wrongState(status);
      return { ok: true, nextStatus: "NO_SHOW" };
    }

    // ── §36 — le client refuse de payer ────────────────────────────────────
    //
    // Voie de sortie du verrouillage du §12 : sans elle, une prestation réalisée mais
    // non réglée resterait bloquée à l'encaissement pour toujours.
    //
    // Elle n'est ouverte que si la preuve existe. C'est tout l'intérêt du workflow :
    // photos après et signature font la différence entre un impayé défendable et la
    // parole de l'opérateur contre celle du client.
    case "MARK_UNPAID": {
      if (status !== "PAYMENT") return wrongState(status);

      const missing = missingSlots(snapshot.photos, "AFTER");
      if (missing.length > 0 || !snapshot.hasSignature) {
        return {
          ok: false,
          code: "PROOF_MISSING",
          message:
            "Impossible sans preuve complète : " +
            [
              missing.length > 0 ? `${missing.length} photo(s) après manquante(s)` : null,
              snapshot.hasSignature ? null : "signature du client absente",
            ]
              .filter(Boolean)
              .join(", ") +
            ".",
        };
      }

      return { ok: true, nextStatus: "UNPAID" };
    }
  }
}
