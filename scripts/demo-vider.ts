import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { wipeDataset } from "../src/server/demo/dataset";

/** Vide la base pour vérifier ce que voit quelqu'un qui ouvre un déploiement neuf. */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

wipeDataset(prisma)
  .then(() => console.info("Base vidée."))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
