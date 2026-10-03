import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Contrôle des preuves attachées aux prestations terminées (§13, §32, §36). */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const done = await prisma.appointment.findMany({
    where: { status: "COMPLETED" },
    select: {
      reference: true,
      photos: { select: { phase: true } },
      signature: { select: { signerName: true } },
    },
    orderBy: { reference: "asc" },
  });

  for (const a of done) {
    const before = a.photos.filter((p) => p.phase === "BEFORE").length;
    const after = a.photos.filter((p) => p.phase === "AFTER").length;
    console.info(
      `${a.reference}  ${before} avant · ${after} après · ${a.photos.length} au total` +
        `  ${a.signature ? `signé ${a.signature.signerName}` : "SANS SIGNATURE"}`,
    );
  }
  console.info(`\n${done.length} prestations terminées.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
