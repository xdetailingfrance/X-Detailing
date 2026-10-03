import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDataset } from "../src/server/demo/dataset";

/** Lance la génération du jeu de données depuis la ligne de commande (`npm run db:seed`). */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

seedDataset(prisma)
  .then((counts) => {
    console.info("Jeu de données créé :", counts);
    console.info("Connexion : patron@xdetailing.fr / xdetailing");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
