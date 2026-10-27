// Chargement des données :
//   npm run db:catalogue        → catalogue réel (prestations, prix, options)
//   npm run db:demo             → données de démonstration (identifiants « demo- »)
//   npm run db:demo:supprimer   → retire toutes les données de démonstration
import "dotenv/config";
import { adaptateurPg } from "../src/lib/connexion";
import { PrismaClient } from "../src/generated/prisma/client";
import { semerCatalogue } from "./catalogue";
import { semerDemo, supprimerDemo } from "./seedData";

const db = new PrismaClient({ adapter: adaptateurPg() });

async function main() {
  const commande = process.argv[2];
  if (commande === "catalogue") console.log("Catalogue chargé :", await semerCatalogue(db));
  else if (commande === "demo") console.log("Démonstration chargée :", await semerDemo(db));
  else if (commande === "supprimer-demo") {
    await supprimerDemo(db);
    console.log("Données de démonstration supprimées.");
  } else {
    console.error("Usage : tsx prisma/seed.ts catalogue | demo | supprimer-demo");
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

