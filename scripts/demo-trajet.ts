import "dotenv/config";
import { prisma } from "@/server/db";
import { performTransition } from "@/server/workflow/state-machine";
import { recordPing } from "@/server/tracking";

/**
 * Met un rendez-vous du jour en trajet et y pousse quelques positions, pour visualiser
 * la carte live sans avoir un opérateur sur la route.
 */
async function main() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const appointment = await prisma.appointment.findFirst({
    where: {
      status: "CONFIRMED",
      scheduledStart: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 3600_000) },
    },
    orderBy: { scheduledStart: "asc" },
    select: { id: true, reference: true, operatorId: true, lat: true, lng: true, publicToken: true },
  });

  if (!appointment?.operatorId) {
    console.info("Aucun rendez-vous confirmé aujourd'hui.");
    return;
  }

  await performTransition({
    appointmentId: appointment.id,
    transition: "START_TRIP",
    actor: { userId: null, label: "Démonstration", operatorId: appointment.operatorId },
  });

  // Trois positions qui se rapprochent, comme un vrai trajet.
  for (const [dLat, dLng] of [[0.055, 0.03], [0.03, 0.018], [0.014, 0.008]]) {
    const result = await recordPing({
      appointmentId: appointment.id,
      operatorId: appointment.operatorId,
      lat: appointment.lat + dLat,
      lng: appointment.lng + dLng,
      speedKph: 42,
    });
    console.info(
      result.ok
        ? `  position enregistrée · ${result.remainingKm} km · arrivée ${result.etaAt?.slice(11, 16) ?? "—"}`
        : `  refusé : ${result.error}`,
    );
  }

  console.info(`\n${appointment.reference} en trajet.`);
  console.info(`  Carte patron  : http://localhost:3000/admin/carte`);
  console.info(`  Suivi client  : http://localhost:3000/reservation/${appointment.publicToken}`);

  await prisma.$disconnect();
}

main();
