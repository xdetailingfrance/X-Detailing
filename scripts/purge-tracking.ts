import "dotenv/config";
import { prisma } from "@/server/db";
import { purgeOldPings } from "@/server/tracking";

/**
 * §31 — politique de conservation des données de déplacement.
 *
 * À programmer en tâche récurrente (cron quotidien) avant la mise en production : une
 * politique de conservation qui n'est jamais exécutée n'en est pas une.
 */
async function main() {
  const { deleted, cutoff } = await purgeOldPings();
  console.info(
    `${deleted} position(s) supprimée(s), antérieure(s) au ${cutoff.toLocaleDateString("fr-FR")}.`,
  );
  await prisma.$disconnect();
}

main();
