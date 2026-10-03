import "dotenv/config";
import { prisma } from "@/server/db";
import { performTransition } from "@/server/workflow/state-machine";
import { recordPing, getClientTracking, getNetworkTracking, purgeOldPings } from "@/server/tracking";

/**
 * Vérifie la règle de confidentialité du §11 : « le GPS ne doit pas fonctionner en
 * permanence ». C'est la garantie la plus sensible de la phase 4 — elle est vérifiée
 * contre la vraie base, pas seulement raisonnée.
 */

const ok = (label: string) => console.info(`  ✓ ${label}`);
const ko = (label: string) => {
  console.error(`  ✗ ${label}`);
  process.exitCode = 1;
};
const check = (condition: boolean, label: string) => (condition ? ok(label) : ko(label));

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
    console.info("Aucun rendez-vous confirmé aujourd'hui — relancez `npm run db:seed`.");
    return;
  }

  const actor = { userId: null, label: "Vérification", operatorId: appointment.operatorId };
  const ping = (lat: number, lng: number) =>
    recordPing({ appointmentId: appointment.id, operatorId: appointment.operatorId!, lat, lng });

  console.info(`\n${appointment.reference}\n`);

  // ── Avant le trajet : aucune position ne doit être acceptée ───────────────
  const before = await ping(45.75, 4.85);
  check(!before.ok && before.stopTracking, "un ping hors trajet est refusé, avec ordre d'arrêt");

  const pingsBefore = await prisma.trackingPing.count({ where: { appointmentId: appointment.id } });
  check(pingsBefore === 0, "aucune position n'a été conservée avant le trajet");

  // ── Pendant le trajet ─────────────────────────────────────────────────────
  await performTransition({ appointmentId: appointment.id, transition: "START_TRIP", actor });

  // Point de départ : environ 8 km de la destination.
  const far = await ping(appointment.lat + 0.07, appointment.lng + 0.03);
  check(far.ok, "un ping pendant le trajet est accepté");
  if (far.ok) {
    check(far.etaAt !== null, `une heure d'arrivée est calculée (${far.etaAt?.slice(11, 16)})`);
    check(!far.arrivingSoon, `à ${far.remainingKm} km, le client n'est pas encore prévenu`);
  }

  // Point d'approche : moins de 400 m.
  const near = await ping(appointment.lat + 0.002, appointment.lng + 0.001);
  check(near.ok && near.arrivingSoon, "à l'approche, l'alerte « presque arrivé » se déclenche");

  const warned = await prisma.appointmentEvent.count({
    where: { appointmentId: appointment.id, note: { startsWith: "Approche" } },
  });
  await ping(appointment.lat + 0.001, appointment.lng);
  const warnedAgain = await prisma.appointmentEvent.count({
    where: { appointmentId: appointment.id, note: { startsWith: "Approche" } },
  });
  check(warned === 1 && warnedAgain === 1, "le client n'est prévenu qu'une seule fois");

  // ── Ce que voit le client ─────────────────────────────────────────────────
  const live = await getClientTracking(appointment.publicToken);
  check(live?.position !== null, "le client voit la position pendant le trajet");
  check(
    live?.operatorFirstName !== null && !String(live?.operatorFirstName).includes(" "),
    "le client ne voit que le prénom de l'opérateur",
  );

  // ── Ce que voit le patron ─────────────────────────────────────────────────
  const network = await getNetworkTracking();
  const tracked = network.operators.find((o) => o.operatorId === appointment.operatorId);
  check(tracked?.status === "EN_ROUTE", "le patron voit l'opérateur en trajet");
  check(tracked?.current?.etaAt != null, "le patron voit l'heure d'arrivée estimée");

  // ── Après l'arrivée : le partage s'arrête ────────────────────────────────
  await performTransition({ appointmentId: appointment.id, transition: "ARRIVE", actor });

  const after = await ping(appointment.lat, appointment.lng);
  check(!after.ok && after.stopTracking, "après l'arrivée, tout ping est refusé");

  const closed = await getClientTracking(appointment.publicToken);
  check(closed?.position === null, "la position n'est plus exposée au client après l'arrivée");

  // ── Conservation (§31) ───────────────────────────────────────────────────
  const purge = await purgeOldPings(30);
  console.info(
    `\n  Purge : ${purge.deleted} position(s) antérieure(s) au ${purge.cutoff.toISOString().slice(0, 10)}`,
  );

  const kept = await prisma.trackingPing.count({ where: { appointmentId: appointment.id } });
  console.info(`  Positions conservées pour ce trajet : ${kept}`);

  await prisma.$disconnect();
}

main();
