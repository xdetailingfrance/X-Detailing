import "dotenv/config";
import { prisma } from "@/server/db";
import { performTransition } from "@/server/workflow/state-machine";

/**
 * Amène un rendez-vous jusqu'à l'arrivée, pour regarder l'écran de prise en charge
 * sans attendre l'heure du créneau. Passe par les transitions réelles : si une garde
 * refuse, on le voit ici plutôt que sur le terrain.
 */
async function main() {
  const appointment = await prisma.appointment.findFirst({
    where: { status: "CONFIRMED" },
    orderBy: { scheduledStart: "asc" },
    select: { id: true, reference: true, operatorId: true, scheduledStart: true },
  });

  if (!appointment?.operatorId) {
    console.info("Aucun rendez-vous confirmé.");
    return;
  }

  const startAt = new Date(appointment.scheduledStart.getTime() - 20 * 60_000);

  for (const transition of ["START_TRIP", "ARRIVE"] as const) {
    const result = await performTransition({
      appointmentId: appointment.id,
      transition,
      actor: { userId: null, label: "Démonstration", operatorId: appointment.operatorId },
      // Le créneau est peut-être demain : on se place à son heure pour que la garde
      // « trop tôt » juge la même chose que l'opérateur sur place le jour venu.
      now: startAt,
    });
    console.info(transition, result.ok ? "→ ok" : `refusé : ${result.message}`);
    if (!result.ok) return;
  }

  console.info(`\n${appointment.reference} · /pro/${appointment.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
