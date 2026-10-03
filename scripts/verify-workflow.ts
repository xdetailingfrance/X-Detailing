import "dotenv/config";
import { prisma } from "@/server/db";
import { performTransition } from "@/server/workflow/state-machine";
import { REQUIRED_SLOTS } from "@/server/workflow/types";
import { recordCashPayment, getPaymentSummary } from "@/server/payments";
import { formatEuros } from "@/server/pricing";

/**
 * Vérification de bout en bout du workflow §12 → §18, contre la vraie base.
 *
 * Complète les tests unitaires des gardes : ceux-ci prouvent les règles, celui-ci
 * prouve que les effets de bord (commission, alertes, horodatages) suivent bien.
 */

async function main() {
  // Un rendez-vous du jour : la garde « trop tôt » du §12 refuse de démarrer un trajet
  // plus de trois heures avant l'heure prévue.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);

  const appointment = await prisma.appointment.findFirst({
    where: { status: "CONFIRMED", scheduledStart: { gte: dayStart, lt: dayEnd } },
    orderBy: { scheduledStart: "asc" },
    include: { operator: { select: { id: true, firstName: true, commissionRate: true } } },
  });

  if (!appointment?.operator) {
    console.info("Aucun rendez-vous confirmé aujourd'hui — relancez `npm run db:seed`.");
    return;
  }

  const actor = {
    userId: null,
    label: `${appointment.operator.firstName} (vérification)`,
    operatorId: appointment.operator.id,
  };

  console.info(`\n${appointment.reference} — ${formatEuros(appointment.totalCents)}\n`);

  const step = async (transition: Parameters<typeof performTransition>[0]["transition"]) => {
    const result = await performTransition({ appointmentId: appointment.id, transition, actor });
    console.info(
      result.ok
        ? `  ✓ ${transition.padEnd(24)} → ${result.status}`
        : `  ✗ ${transition.padEnd(24)} refusé : ${result.message}`,
    );
    return result.ok;
  };

  const addPhotos = async (phase: "BEFORE" | "AFTER") => {
    await prisma.photo.createMany({
      data: REQUIRED_SLOTS.map((slot) => ({
        appointmentId: appointment.id,
        customerVehicleId: appointment.customerVehicleId,
        phase,
        slot,
        path: `verification/${appointment.id}/${phase}-${slot}.jpg`,
        capturedInApp: true,
      })),
    });
    console.info(`  · ${REQUIRED_SLOTS.length} photos ${phase} enregistrées`);
  };

  await step("START_TRIP");
  await step("ARRIVE");

  console.info("\n  Tentative de contournement :");
  await step("START_SERVICE"); // doit être refusé : photos avant non validées

  console.info("");
  await addPhotos("BEFORE");
  await step("VALIDATE_PHOTOS_BEFORE");
  await step("START_SERVICE");

  await addPhotos("AFTER");
  await step("VALIDATE_PHOTOS_AFTER");
  await step("OPEN_PAYMENT");

  const before = await getPaymentSummary(appointment.id);
  console.info(`\n  Solde à encaisser : ${formatEuros(before.balanceCents)}`);

  const cash = await recordCashPayment({
    appointmentId: appointment.id,
    operatorId: appointment.operator.id,
    expectedCents: before.balanceCents,
    receivedCents: before.balanceCents,
    actor: { userId: null, label: actor.label },
  });
  console.info(`  · espèces enregistrées, écart ${cash.ok ? cash.discrepancyCents : "?"}`);

  await step("COMPLETE");

  const [commission, summary, events, alerts] = await Promise.all([
    prisma.commission.findUnique({ where: { appointmentId: appointment.id } }),
    getPaymentSummary(appointment.id),
    prisma.appointmentEvent.count({ where: { appointmentId: appointment.id } }),
    prisma.alert.count({ where: { appointmentId: appointment.id, status: "OPEN" } }),
  ]);

  const final = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    select: {
      status: true, enRouteAt: true, arrivedAt: true, photosBeforeAt: true,
      startedAt: true, photosAfterAt: true, paidAt: true, finishedAt: true,
    },
  });

  console.info("\n  Résultat :");
  console.info(`    statut        ${final.status}`);
  console.info(`    encaissé      ${formatEuros(summary.paidCents)} · écart ${summary.discrepancyCents}`);
  console.info(
    `    commission    ${commission ? `${formatEuros(commission.amountCents)} (${(Number(commission.rate) * 100).toFixed(0)} %)` : "ABSENTE"}`,
  );
  console.info(`    événements    ${events}`);
  console.info(`    alertes       ${alerts}`);
  console.info("    horodatages   " + Object.entries(final)
    .filter(([key]) => key.endsWith("At"))
    .map(([key, value]) => `${key.replace("At", "")}${value ? "✓" : "✗"}`)
    .join(" "));

  await prisma.$disconnect();
}

main();
