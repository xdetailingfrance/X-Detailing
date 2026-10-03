import "dotenv/config";
import { prisma } from "@/server/db";
import { findBestOperators } from "@/server/assignment/engine";
import { DEFAULT_ASSIGNMENT_SETTINGS, type OperatorSnapshot } from "@/server/assignment/types";
import { LocalGeoProvider } from "@/lib/providers/geo/local";
import { loadOperatorSnapshots } from "@/server/assignment/snapshot";
import { getDashboard } from "@/server/dashboard";
import { getOperatorStatistics } from "@/server/statistics";
import { getNetworkTracking } from "@/server/tracking";

/**
 * §33 — « les calculs d'affectation doivent être exécutés en quelques secondes »
 * §1  — « passer de quelques opérateurs à plusieurs dizaines sans refonte »
 *
 * Mesure le moteur seul, sur des instantanés synthétiques : c'est la partie dont le coût
 * croît avec la taille du réseau. Les requêtes du back-office sont mesurées à part, sur
 * la vraie base.
 */

const CLIENT = { lat: 45.764, lng: 4.8357 };
const MONDAY = new Date();
MONDAY.setHours(14, 0, 0, 0);

/** Opérateurs répartis autour de Lyon, avec une tournée déjà partiellement remplie. */
function syntheticOperators(count: number): OperatorSnapshot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const radius = 0.03 + (i % 7) * 0.012;
    const home = {
      lat: CLIENT.lat + Math.sin(angle) * radius,
      lng: CLIENT.lng + Math.cos(angle) * radius,
    };

    const jobCount = i % 4;
    const jobsOnDay = Array.from({ length: jobCount }, (_, j) => {
      const start = new Date(MONDAY);
      start.setHours(8 + j * 2, 0, 0, 0);
      return {
        id: `job-${i}-${j}`,
        start,
        end: new Date(start.getTime() + 90 * 60_000),
        lat: home.lat + 0.004 * (j + 1),
        lng: home.lng + 0.004 * (j + 1),
        label: `RDV ${j + 1}`,
      };
    });

    return {
      id: `op-${i}`,
      code: `OP-${String(i).padStart(3, "0")}`,
      name: `Opérateur ${i}`,
      status: "ACTIVE" as const,
      home,
      homeSectorId: `sector-${i % 8}`,
      sectorIds: [`sector-${i % 8}`],
      serviceIds: ["svc"],
      qualityScore: 70 + (i % 30),
      targetJobsPerDay: 5,
      maxTravelMinOverride: null,
      workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        startMinute: 8 * 60,
        endMinute: 19 * 60,
        breakStartMinute: 12 * 60 + 30,
        breakEndMinute: 13 * 60 + 30,
      })),
      timeOff: [],
      jobsOnDay,
      revenueTodayCents: jobCount * 7000,
      revenueWeekCents: (i % 11) * 9000,
      jobsWeekCount: jobCount * 4,
    };
  });
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const result = await run();
  const ms = performance.now() - started;
  const mark = ms < 100 ? "✓" : ms < 1000 ? "·" : "!";
  console.info(`  ${mark} ${label.padEnd(46)} ${ms.toFixed(0).padStart(6)} ms`);
  return result;
}

async function main() {
  const geo = new LocalGeoProvider("benchmark");

  console.info("\nMoteur d'affectation — instantanés synthétiques\n");

  for (const size of [5, 20, 50, 100, 250]) {
    const operators = syntheticOperators(size);
    const result = await timed(`${String(size).padStart(3)} opérateurs`, () =>
      findBestOperators({
        request: {
          address: "Place Bellecour, 69002 Lyon",
          lat: CLIENT.lat,
          lng: CLIENT.lng,
          start: MONDAY,
          durationMin: 90,
          serviceId: "svc",
          sectorId: "sector-0",
        },
        operators,
        settings: DEFAULT_ASSIGNMENT_SETTINGS,
        geo,
      }),
    );
    console.info(
      `      ${result.candidates.length} proposés · ${result.rejected.length} écartés · ` +
        `meilleur score ${result.candidates[0]?.score ?? "—"}`,
    );
  }

  console.info("\nRequêtes du back-office — base réelle\n");

  await timed("instantané du réseau (moteur)", () => loadOperatorSnapshots(new Date()));
  await timed("tableau de bord · jour", () => getDashboard("jour"));
  await timed("tableau de bord · mois", () => getDashboard("mois"));
  await timed("statistiques · mois", () => getOperatorStatistics("mois"));
  await timed("carte du réseau", () => getNetworkTracking());

  const counts = await timed("volumétrie", async () => ({
    opérateurs: await prisma.operator.count(),
    clients: await prisma.customer.count(),
    rendezVous: await prisma.appointment.count(),
    positions: await prisma.trackingPing.count(),
  }));

  console.info(
    `\n  Base : ${counts.opérateurs} opérateurs · ${counts.clients} clients · ` +
      `${counts.rendezVous} rendez-vous · ${counts.positions} positions\n`,
  );

  await prisma.$disconnect();
}

main();
