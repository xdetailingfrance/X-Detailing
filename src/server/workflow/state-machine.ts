import { prisma } from "../db";
import { recordAudit } from "../audit";
import { raiseAlert, resolveAlerts } from "../quality/alerts";
import { computeCommission } from "../commission";
import { offerFreedSlot } from "../dispatch/slot-resale";
import { notificationProvider } from "@/lib/providers/notifications";
import { BOOKING_CONFIRMATION_TEMPLATE } from "../notification-templates";
import type {
  AppointmentEventType,
  AppointmentStatus,
} from "@/generated/prisma/enums";
import { checkTransition } from "./guards";
import type { GuardFailure, Transition, WorkflowSnapshot } from "./types";

/**
 * Exécution d'une transition du workflow (§12).
 *
 * Chaque transition, dans une seule opération atomique :
 *   1. relit l'état,
 *   2. vérifie la garde,
 *   3. écrit le nouvel état **sous condition de l'état source**,
 *   4. horodate l'étape,
 *   5. insère l'événement (§12 « chaque étape est horodatée »),
 *   6. journalise (§30),
 *   7. déclenche alertes et notifications (§27).
 *
 * L'étape 3 est conditionnelle plutôt que verrouillante : `updateMany` avec le statut
 * attendu dans le `where` est atomique en PostgreSQL. Deux appuis simultanés sur
 * « J'ai terminé » ne peuvent donc pas produire deux clôtures.
 */

const EVENT_OF: Record<Transition, AppointmentEventType> = {
  START_TRIP: "EN_ROUTE",
  ARRIVE: "ARRIVED",
  VALIDATE_PHOTOS_BEFORE: "PHOTOS_BEFORE_VALIDATED",
  START_SERVICE: "STARTED",
  VALIDATE_PHOTOS_AFTER: "PHOTOS_AFTER_VALIDATED",
  OPEN_PAYMENT: "PAYMENT_RECORDED",
  COMPLETE: "COMPLETED",
  CANCEL: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  MARK_UNPAID: "NOTE",
};

const AUDIT_OF: Record<Transition, string> = {
  START_TRIP: "TRAJET_DEMARRE",
  ARRIVE: "ARRIVEE_CONFIRMEE",
  VALIDATE_PHOTOS_BEFORE: "PHOTOS_AVANT_VALIDEES",
  START_SERVICE: "PRESTATION_DEMARREE",
  VALIDATE_PHOTOS_AFTER: "PHOTOS_APRES_VALIDEES",
  OPEN_PAYMENT: "ENCAISSEMENT_OUVERT",
  COMPLETE: "PRESTATION_TERMINEE",
  CANCEL: "RDV_ANNULE",
  NO_SHOW: "CLIENT_ABSENT",
  MARK_UNPAID: "IMPAYE_DECLARE",
};

/** Horodatage dédié écrit par la transition, en plus du statut. */
function stamps(transition: Transition, now: Date): Record<string, Date | null> {
  switch (transition) {
    case "START_TRIP": return { enRouteAt: now };
    case "ARRIVE": return { arrivedAt: now };
    case "VALIDATE_PHOTOS_BEFORE": return { photosBeforeAt: now };
    case "START_SERVICE": return { startedAt: now };
    case "VALIDATE_PHOTOS_AFTER": return { photosAfterAt: now };
    case "COMPLETE": return { finishedAt: now };
    case "CANCEL":
    case "NO_SHOW": return { cancelledAt: now };
    default: return {};
  }
}

export type Actor = {
  userId: string | null;
  label: string;
  /** `null` pour le back-office : il n'est pas soumis à la règle d'appartenance. */
  operatorId: string | null;
};

export type TransitionSuccess = { ok: true; status: AppointmentStatus };
export type TransitionResult = TransitionSuccess | GuardFailure;

export async function getWorkflowSnapshot(appointmentId: string): Promise<WorkflowSnapshot | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true, reference: true, status: true, operatorId: true,
      scheduledStart: true, totalCents: true, arrivedAt: true, startedAt: true,
      photos: { select: { phase: true, slot: true } },
      payments: {
        select: { status: true, amountCents: true, receivedCents: true, discrepancyCents: true },
      },
      signature: { select: { id: true } },
      vehicleAdjustment: { select: { acceptedAt: true } },
    },
  });

  if (!appointment) return null;

  const { signature, vehicleAdjustment, ...rest } = appointment;
  return {
    ...rest,
    hasSignature: signature !== null,
    pendingAdjustment: vehicleAdjustment !== null && vehicleAdjustment.acceptedAt === null,
  };
}

export async function performTransition(input: {
  appointmentId: string;
  transition: Transition;
  actor: Actor;
  note?: string;
  cancelReason?: string;
  now?: Date;
}): Promise<TransitionResult> {
  const now = input.now ?? new Date();

  const snapshot = await getWorkflowSnapshot(input.appointmentId);
  if (!snapshot) {
    return { ok: false, code: "WRONG_STATE", message: "Rendez-vous introuvable." };
  }

  const guard = checkTransition(input.transition, snapshot, {
    operatorId: input.actor.operatorId,
    now,
  });
  if (!guard.ok) return guard;

  const previousStatus = snapshot.status;

  const applied = await prisma.$transaction(async (tx) => {
    // Le statut source dans le `where` rend l'écriture atomique : si un autre appel a
    // fait avancer le rendez-vous entre-temps, `count` vaut 0 et rien n'est écrit.
    const { count } = await tx.appointment.updateMany({
      where: { id: snapshot.id, status: previousStatus },
      data: {
        status: guard.nextStatus,
        ...stamps(input.transition, now),
        ...(input.cancelReason ? { cancelReason: input.cancelReason } : {}),
        ...(input.actor.userId && (input.transition === "CANCEL" || input.transition === "NO_SHOW")
          ? { cancelledByUserId: input.actor.userId }
          : {}),
      },
    });

    if (count === 0) return false;

    await tx.appointmentEvent.create({
      data: {
        appointmentId: snapshot.id,
        type: EVENT_OF[input.transition],
        at: now,
        userId: input.actor.userId,
        operatorId: input.actor.operatorId ?? snapshot.operatorId,
        note: input.note ?? null,
      },
    });

    return true;
  });

  if (!applied) {
    return {
      ok: false,
      code: "WRONG_STATE",
      message: "Le rendez-vous a changé entre-temps. Rechargez la page.",
    };
  }

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: AUDIT_OF[input.transition],
    entityType: "Appointment",
    entityId: snapshot.id,
    before: { status: previousStatus },
    after: { status: guard.nextStatus },
  });

  await afterTransition(input.transition, snapshot, now);

  return { ok: true, status: guard.nextStatus };
}

/** Effets de bord qui suivent la transition, hors de la transaction. */
async function afterTransition(
  transition: Transition,
  snapshot: WorkflowSnapshot,
  now: Date,
): Promise<void> {
  if (transition === "COMPLETE") {
    // §18 — la commission est figée ici, avec le taux en vigueur pour cet opérateur.
    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: snapshot.id },
      select: {
        totalCents: true,
        operatorId: true,
        reference: true,
        customer: { select: { email: true, phone: true, firstName: true } },
        operator: { select: { commissionRate: true } },
      },
    });

    if (appointment.operatorId && appointment.operator) {
      const commission = computeCommission({
        appointmentId: snapshot.id,
        operatorId: appointment.operatorId,
        baseCents: appointment.totalCents,
        rate: appointment.operator.commissionRate,
        at: now,
      });

      await prisma.commission.upsert({
        where: { appointmentId: snapshot.id },
        create: commission,
        update: {},
      });
    }

    // `reviewRequestedAt` reste vide ici : la demande d'avis est envoyée par la tâche
    // `demande-avis`, deux heures plus tard. Demander un avis dans la minute qui suit
    // la prestation, c'est demander avant que le client ait regardé sa voiture (§25).
    await prisma.appointment.update({
      where: { id: snapshot.id },
      data: { paidAt: now },
    });

    await resolveAlerts(snapshot.id, ["PHOTOS_MISSING", "WORKFLOW_BLOCKED", "PAYMENT_MISSING"]);

    // §17 — « le client reçoit automatiquement le récapitulatif ».
    const recipient = appointment.customer.email ?? appointment.customer.phone;
    await notificationProvider().send({
      channel: appointment.customer.email ? "EMAIL" : "SMS",
      recipient,
      template: BOOKING_CONFIRMATION_TEMPLATE,
      payload: { reference: appointment.reference, prenom: appointment.customer.firstName },
    });
  }

  // §8 — un créneau libéré est immédiatement proposé aux clients proches ou flexibles,
  // pour ne pas laisser un trou dans la tournée.
  if (transition === "CANCEL") {
    await offerFreedSlot({ cancelledAppointmentId: snapshot.id, now });
  }

  if (transition === "MARK_UNPAID") {
    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: snapshot.id },
      select: { totalCents: true, customerId: true },
    });

    await raiseAlert({
      type: "PAYMENT_MISSING",
      severity: "CRITICAL",
      title: `Impayé — ${snapshot.reference}`,
      message:
        `Prestation réalisée, ${(appointment.totalCents / 100).toFixed(2)} € non réglés. ` +
        "Photos avant/après et signature du client sont au dossier.",
      appointmentId: snapshot.id,
      operatorId: snapshot.operatorId,
      customerId: appointment.customerId,
    });
  }

  if (transition === "NO_SHOW") {
    await raiseAlert({
      type: "COMPLAINT",
      severity: "WARNING",
      title: `Client absent — ${snapshot.reference}`,
      message: "L'opérateur s'est déplacé sans pouvoir réaliser la prestation.",
      appointmentId: snapshot.id,
      operatorId: snapshot.operatorId,
    });
  }
}
