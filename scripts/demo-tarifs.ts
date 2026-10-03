import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Contrôle de la grille tarifaire publiée. */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const services = await prisma.service.findMany({
    orderBy: { sortOrder: "asc" },
    include: { pricing: { orderBy: { priceCents: "asc" } } },
  });
  for (const service of services) {
    console.info(`\n${service.name} (${service.kind})`);
    for (const p of service.pricing) {
      const barre = p.compareAtCents ? ` (barré ${p.compareAtCents / 100} €)` : "";
      console.info(`  ${p.vehicleClass.padEnd(16)} ${p.priceCents / 100} €${barre} · ${p.durationMin} min`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
