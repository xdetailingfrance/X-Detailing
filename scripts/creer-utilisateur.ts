// Crée (ou réactive) un compte de connexion au back-office.
//   npm run creer-utilisateur -- <email> <ROLE> [operateurId]
// ROLE : OWNER (directeur), RESPONSABLE, COMMERCIAL, OPERATEUR, COMPTABLE.
// Le mot de passe est demandé dans le terminal (12 caractères minimum),
// jamais passé en argument ni enregistré en clair.
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { adaptateurPg } from "../src/lib/connexion";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashMotDePasse } from "../src/lib/auth";

const ROLES = ["OWNER", "RESPONSABLE", "COMMERCIAL", "OPERATEUR", "COMPTABLE"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [email, role, operateurId] = process.argv.slice(2);
  if (!email || !ROLES.includes(role as Role)) {
    console.error("Usage : npm run creer-utilisateur -- <email> <OWNER|RESPONSABLE|COMMERCIAL|OPERATEUR|COMPTABLE> [operateurId]");
    process.exit(1);
  }
  if (role === "OPERATEUR" && !operateurId) {
    console.error("Un compte OPERATEUR doit être lié à une fiche opérateur (operateurId).");
    process.exit(1);
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const motDePasse = process.env.MOT_DE_PASSE_INITIAL ?? (await terminal.question("Mot de passe (12 caractères minimum) : "));
  terminal.close();
  if (motDePasse.length < 12) {
    console.error("Mot de passe trop court.");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: adaptateurPg() });
  const donnees = {
    passwordHash: await hashMotDePasse(motDePasse),
    role: role as Role,
    actif: true,
    operateurId: operateurId ?? null,
  };
  const compte = await db.utilisateur.upsert({
    where: { email: email.trim().toLowerCase() },
    update: donnees,
    create: { email: email.trim().toLowerCase(), ...donnees },
  });
  await db.journalAudit.create({
    data: { acteur: "systeme", action: "COMPTE_CREE_EN_LIGNE_DE_COMMANDE", entite: "Utilisateur", entiteId: compte.id, details: { email: compte.email, role } },
  });
  console.log(`Compte prêt : ${compte.email} (${compte.role}).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

