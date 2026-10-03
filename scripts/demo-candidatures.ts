import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Liste les candidatures reçues via la landing opérateur. */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = await prisma.operatorApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (rows.length === 0) console.info("Aucune candidature.");
  for (const row of rows) {
    console.info(
      `${row.createdAt.toISOString().slice(0, 16)}  ${row.firstName} ${row.lastName} · ${row.city} · ${row.phone}` +
        ` · apport ${row.hasFunding ? "oui" : "non"} · ${row.stage}`,
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
