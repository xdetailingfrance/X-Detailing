import { prisma } from "../db";
import { REQUIRED_SLOTS } from "../workflow/types";
import { computeQualityScore, type QualityBreakdown } from "./score";
import { raiseAlert } from "./alerts";
import { recordAudit } from "../audit";

export { computeQualityScore, NEUTRAL_SCORE } from "./score";
export type { QualityInput, QualityBreakdown } from "./score";

/**
 * Recalcul du score qualité (§25) et traitement des avis.
 *
 * Le score alimente l'axe « qualité » du moteur d'affectation (§4) : il est donc
 * recalculé à partir des faits enregistrés, jamais saisi à la main.
 */

const EXPECTED_PHOTOS = REQUIRED_SLOTS.length * 2;

export async function recomputeQualityScore(operatorId: string): Promise<QualityBreakdown> {
  const [appointments, reviews, complaints] = await Promise.all([
    prisma.appointment.findMany({
      where: { operatorId },
      select: {
        status: true, scheduledStart: true, startedAt: true,
        _count: { select: { photos: true } },
      },
    }),
    prisma.review.findMany({ where: { operatorId }, select: { rating: true } }),
    prisma.alert.count({ where: { operatorId, type: { in: ["COMPLAINT", "LOW_REVIEW"] } } }),
  ]);

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const started = appointments.filter((a) => a.startedAt !== null);
  const onTime = started.filter(
    (a) => a.startedAt!.getTime() - a.scheduledStart.getTime() <= 10 * 60_000,
  );

  const breakdown = computeQualityScore({
    averageRating: reviews.length
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null,
    reviewCount: reviews.length,
    punctuality: started.length > 0 ? onTime.length / started.length : null,
    completedWithFullPhotos: completed.filter((a) => a._count.photos >= EXPECTED_PHOTOS).length,
    completedCount: completed.length,
    complaints,
    noShows: appointments.filter((a) => a.status === "NO_SHOW").length,
  });

  await prisma.operator.update({
    where: { id: operatorId },
    data: { qualityScore: breakdown.score },
  });

  return breakdown;
}

export type ReviewResult = { ok: true; routedToGoogle: boolean } | { ok: false; error: string };

/** Seuil au-delà duquel on oriente vers Google, en dessous duquel on alerte (§25). */
const GOOD_REVIEW = 5;
const LOW_REVIEW = 3;

export async function submitReview(input: {
  publicToken: string;
  rating: number;
  comment?: string | null;
}): Promise<ReviewResult> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return { ok: false, error: "Note invalide." };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { publicToken: input.publicToken },
    select: {
      id: true, reference: true, status: true, customerId: true, operatorId: true,
      review: { select: { id: true } },
      operator: { select: { firstName: true, lastName: true } },
    },
  });

  if (!appointment) return { ok: false, error: "Réservation introuvable." };
  if (appointment.status !== "COMPLETED") {
    return { ok: false, error: "L'avis n'est possible qu'une fois la prestation terminée." };
  }
  if (appointment.review) return { ok: false, error: "Un avis a déjà été déposé." };
  if (!appointment.operatorId) return { ok: false, error: "Prestation sans opérateur." };

  // §25 — « les très bons avis peuvent être orientés vers Google ; les avis faibles
  // doivent déclencher une alerte au central pour traitement. »
  const routedToGoogle = input.rating >= GOOD_REVIEW;

  await prisma.review.create({
    data: {
      appointmentId: appointment.id,
      customerId: appointment.customerId,
      operatorId: appointment.operatorId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      routedToGoogle,
    },
  });

  if (input.rating <= LOW_REVIEW) {
    await raiseAlert({
      type: "LOW_REVIEW",
      severity: input.rating <= 2 ? "CRITICAL" : "WARNING",
      title: `Avis ${input.rating}/5 — ${appointment.reference}`,
      message:
        `${appointment.operator?.firstName} ${appointment.operator?.lastName} · ` +
        (input.comment?.trim() || "sans commentaire") +
        ". À traiter par le central avant qu'il ne parte sur Google.",
      appointmentId: appointment.id,
      operatorId: appointment.operatorId,
      customerId: appointment.customerId,
    });
  }

  await recomputeQualityScore(appointment.operatorId);

  await recordAudit({
    actorUserId: null,
    actorLabel: "Client",
    action: "AVIS_DEPOSE",
    entityType: "Appointment",
    entityId: appointment.id,
    after: { rating: input.rating, routedToGoogle },
  });

  return { ok: true, routedToGoogle };
}
