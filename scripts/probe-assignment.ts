import "dotenv/config";
import { prisma } from "@/server/db";
import { runAssignment } from "@/server/assignment/service";
import { startOfLocalWeek } from "@/server/time";
import { formatEuros } from "@/server/pricing";

async function main() {
  const monday = startOfLocalWeek(new Date());
  const service = await prisma.service.findUniqueOrThrow({ where: { code: "LAV-COMPLET" } });
  const sector = await prisma.sector.findUniqueOrThrow({ where: { code: "LY-N" } });

  // Scénario §36 : un lead appelle, RDV mardi 15h, SUV, intérieur + extérieur, Lyon 6e.
  const result = await runAssignment({
    request: {
      address: "40 rue Vauban, 69006 Lyon",
      lat: 45.7672, lng: 4.8465,
      start: new Date(monday.getTime() + 1 * 24 * 3600_000 + 15 * 3600_000),
      durationMin: 120,
      serviceId: service.id,
      sectorId: sector.id,
    },
    requestedByUserId: null,
  });

  console.info(`\nMoteur exécuté en ${result.durationMs} ms · trafic réel : ${result.trafficAware}\n`);
  for (const [i, c] of result.candidates.entries()) {
    console.info(
      `${i + 1}. ${c.operatorName} (${c.operatorCode}) — ${c.score}/100 · ${c.travelMin} min · ${c.distanceKm} km\n` +
      `   ${c.originLabel} · départ ${c.departAt.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}\n` +
      `   ${c.jobsToday} RDV aujourd'hui · CA semaine ${formatEuros(c.revenueWeekCents)} · charge ${c.loadLevel}` +
      (c.flags.length ? `\n   ⚑ ${c.flags.join(" · ")}` : ""),
    );
    const axes = Object.entries(c.breakdown)
      .map(([axis, detail]) => `${axis} ${detail.raw}×${detail.weight}`)
      .join(" | ");
    console.info(`   ${axes}\n`);
  }
  console.info("Écartés :");
  for (const r of result.rejected) console.info(`  ✗ ${r.operatorName} — ${r.reason} : ${r.detail}`);

  await prisma.$disconnect();
}

main();
