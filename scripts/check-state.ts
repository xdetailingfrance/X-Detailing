import "dotenv/config";
import { prisma } from "@/server/db";
import { formatEuros } from "@/server/pricing";

/** Contrôle rapide de l'état du système — utile après une manipulation manuelle. */
async function main() {
  const appointment = await prisma.appointment.findFirst({
    where: { source: "PHONE" },
    orderBy: { createdAt: "desc" },
    include: {
      operator: { select: { code: true, firstName: true, lastName: true } },
      customer: { select: { firstName: true, lastName: true, phone: true } },
      events: { select: { type: true, note: true } },
      assignmentRuns: { select: { id: true, chosenOperatorId: true, manualOverride: true, durationMs: true } },
      options: true,
    },
  });

  if (!appointment) {
    console.info("Aucun rendez-vous téléphonique en base.");
  } else {
    console.info(`RDV ${appointment.reference} — ${appointment.status}`);
    console.info(`  client    ${appointment.customer.firstName} ${appointment.customer.lastName} · ${appointment.customer.phone}`);
    console.info(`  opérateur ${appointment.operator?.firstName} ${appointment.operator?.lastName} (${appointment.operator?.code}) · score ${appointment.assignmentScore}`);
    console.info(`  adresse   ${appointment.addressLine1}, ${appointment.postalCode} ${appointment.city} (${appointment.lat}, ${appointment.lng})`);
    console.info(`  montant   ${formatEuros(appointment.totalCents)} · acompte ${formatEuros(appointment.depositCents)} · ${appointment.durationMin} min`);
    console.info(`  events    ${appointment.events.map((e) => e.type).join(" → ")}`);
    console.info(`  run lié   ${appointment.assignmentRuns.length > 0 ? `oui (${appointment.assignmentRuns[0].durationMs} ms, manuel: ${appointment.assignmentRuns[0].manualOverride})` : "NON"}`);
  }

  const [runs, orphans, audits] = await Promise.all([
    prisma.assignmentRun.count(),
    prisma.assignmentRun.count({ where: { appointmentId: null } }),
    prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 5, select: { action: true, actorLabel: true, entityType: true } }),
  ]);

  console.info(`\nAssignmentRun : ${runs} archivés, dont ${orphans} sans RDV (recherches non validées)`);
  console.info("Journal d'audit (5 dernières entrées) :");
  for (const entry of audits) console.info(`  ${entry.action} · ${entry.entityType} · ${entry.actorLabel}`);

  await prisma.$disconnect();
}

main();
