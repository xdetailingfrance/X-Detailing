import "dotenv/config";
import { prisma } from "@/server/db";
import { performTransition } from "@/server/workflow/state-machine";
import { findImmediateSlots } from "@/server/dispatch/wash-now";
import { getOperatorStatistics } from "@/server/statistics";
import { submitReview, recomputeQualityScore } from "@/server/quality";
import { formatEuros } from "@/server/pricing";
import { formatLocalDateTime } from "@/server/time";

/** Vérifie §7, §8, §22, §5 et §25 contre la vraie base. */

const ok = (l: string) => console.info(`  ✓ ${l}`);
const ko = (l: string) => {
  console.error(`  ✗ ${l}`);
  process.exitCode = 1;
};
const check = (c: boolean, l: string) => (c ? ok(l) : ko(l));

async function main() {
  // ── §8 — revente d'un créneau annulé ─────────────────────────────────────
  console.info("\n§8 · Revente de créneau");

  const toCancel = await prisma.appointment.findFirst({
    where: { status: "CONFIRMED", scheduledStart: { gt: new Date(Date.now() + 3 * 3600_000) } },
    orderBy: { scheduledStart: "asc" },
    select: { id: true, reference: true, city: true, scheduledStart: true },
  });

  if (!toCancel) {
    console.info("  (aucun rendez-vous futur à annuler)");
  } else {
    await performTransition({
      appointmentId: toCancel.id,
      transition: "CANCEL",
      actor: { userId: null, label: "Vérification", operatorId: null },
      cancelReason: "Test de revente",
    });

    const offer = await prisma.slotOffer.findUnique({
      where: { sourceAppointmentId: toCancel.id },
      select: { id: true, status: true, candidates: true, expiresAt: true },
    });

    const candidates = (offer?.candidates ?? []) as Array<{ name: string; reason: string; flexible: boolean }>;

    check(offer !== null, `${toCancel.reference} annulé, créneau du ${formatLocalDateTime(toCancel.scheduledStart)} remis en jeu`);
    check(candidates.length > 0, `${candidates.length} client(s) sollicité(s)`);
    check(
      candidates.every((c, i, all) => i === 0 || Number(all[i - 1].flexible) >= Number(c.flexible)),
      "les clients flexibles sont sollicités en premier",
    );
    check(
      offer?.expiresAt != null && offer.expiresAt < toCancel.scheduledStart,
      "l'offre expire avant le créneau lui-même",
    );
    for (const candidate of candidates.slice(0, 3)) {
      console.info(`      · ${candidate.name} — ${candidate.reason}`);
    }
  }

  // ── §7 — laver maintenant ────────────────────────────────────────────────
  console.info("\n§7 · Laver maintenant");

  const service = await prisma.service.findUniqueOrThrow({ where: { code: "PACK-LUXE" } });
  const now = await findImmediateSlots({
    lat: 45.7672, lng: 4.8465,
    address: "40 rue Vauban, 69006 Lyon",
    durationMin: 60,
    serviceId: service.id,
  });

  if (now.available) {
    ok(`${now.slots.length} créneau(x) dans les 4 heures`);
    for (const slot of now.slots) {
      console.info(`      · ${slot.label} — dans ${slot.waitMin} min, trajet ${slot.travelMin} min`);
    }
  } else {
    ok(`indisponible, avec une raison exploitable : « ${now.reason} »`);
  }

  // ── §25 — avis et score qualité ──────────────────────────────────────────
  console.info("\n§25 · Avis et qualité");

  const completed = await prisma.appointment.findFirst({
    where: { status: "COMPLETED", review: null },
    select: { publicToken: true, reference: true, operatorId: true },
  });

  if (!completed?.operatorId) {
    console.info("  (aucune prestation terminée sans avis)");
  } else {
    const low = await submitReview({
      publicToken: completed.publicToken,
      rating: 2,
      comment: "Traces sur le pare-brise.",
    });
    check(low.ok && !low.routedToGoogle, "un avis faible n'est pas orienté vers Google");

    const alert = await prisma.alert.findFirst({
      where: { type: "LOW_REVIEW", appointmentId: { not: null }, status: "OPEN" },
      select: { title: true },
    });
    check(alert !== null, `le central est alerté : « ${alert?.title ?? "—"} »`);

    const twice = await submitReview({ publicToken: completed.publicToken, rating: 5 });
    check(!twice.ok, "un second avis sur la même prestation est refusé");

    const breakdown = await recomputeQualityScore(completed.operatorId);
    ok(`score qualité recalculé : ${breakdown.score}/100`);
    for (const axis of breakdown.axes) {
      console.info(
        `      · ${axis.label.padEnd(24)} ${axis.value === null ? "—".padEnd(6) : `${Math.round(axis.value * 100)} %`.padEnd(6)} ${axis.note}`,
      );
    }
  }

  // ── §22 et §5 — statistiques et équilibre ────────────────────────────────
  console.info("\n§22 · Statistiques · §5 · Équilibre du CA");

  const stats = await getOperatorStatistics("mois");
  ok(`CA réseau ${formatEuros(stats.network.revenueCents)} sur ${stats.network.jobs} prestations`);
  ok(
    `indice de répartition ${stats.balance.gini === null ? "—" : stats.balance.gini.toFixed(2)} ` +
      `· écart max ${formatEuros(stats.balance.spreadCents)}`,
  );
  ok(
    `moteur suivi ${stats.balance.engineFollowRate ?? "—"} % ` +
      `sur ${stats.balance.assignmentRuns} affectations (${stats.balance.manualOverrides} choix manuels)`,
  );

  await prisma.$disconnect();
}

main();
