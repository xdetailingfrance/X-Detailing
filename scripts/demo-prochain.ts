import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Donne l'identifiant du prochain rendez-vous confirmé, pour ouvrir l'écran opérateur. */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const next = await prisma.appointment.findFirst({
    where: { status: "CONFIRMED" },
    orderBy: { scheduledStart: "asc" },
    select: {
      id: true, reference: true, scheduledStart: true,
      operator: { select: { user: { select: { email: true } } } },
    },
  });
  console.info(next?.id, next?.reference, next?.operator?.user.email, next?.scheduledStart.toISOString());
}

main().catch(console.error).finally(() => prisma.$disconnect());
