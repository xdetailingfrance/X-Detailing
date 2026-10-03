import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Photographie de l'état du jeu de démonstration : qui a quoi, et dans quel statut. */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = await prisma.appointment.findMany({
    select: {
      reference: true, status: true, scheduledStart: true,
      operator: { select: { user: { select: { email: true } } } },
    },
    orderBy: { scheduledStart: "asc" },
  });
  console.info("maintenant", new Date().toISOString().slice(0, 16));
  for (const r of rows) {
    console.info(
      r.reference,
      r.status.padEnd(12),
      r.scheduledStart.toISOString().slice(0, 16),
      r.operator?.user.email ?? "—",
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
