import "dotenv/config";
import { prisma } from "@/server/db";
import { checkUpcomingWeather } from "@/server/weather";

/**
 * §9 — surveillance météo des prestations à venir.
 *
 * À programmer une à deux fois par jour. Les prestations extérieures menacées par la
 * pluie ou le gel déclenchent une proposition de reprogrammation au client, qui garde
 * la décision.
 */
async function main() {
  const results = await checkUpcomingWeather({ horizonHours: 48 });

  if (results.length === 0) {
    console.info("Aucune prestation à contrôler dans les 48 heures.");
  } else {
    for (const result of results) {
      const mark = result.verdict === "OK" ? "✓" : result.verdict === "RISK" ? "~" : "✗";
      console.info(
        `  ${mark} ${result.reference}  ${result.verdict.padEnd(12)}` +
          `${result.reason ?? ""}${result.rescheduleProposed ? "  → reprogrammation proposée" : ""}`,
      );
    }
    const blocked = results.filter((r) => r.verdict === "INCOMPATIBLE").length;
    console.info(`\n${results.length} prestations contrôlées, ${blocked} incompatible(s).`);
  }

  await prisma.$disconnect();
}

main();
