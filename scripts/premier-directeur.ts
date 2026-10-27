// Crée le premier compte directeur au déploiement, à partir de
// DIRECTEUR_EMAIL et DIRECTEUR_MOT_DE_PASSE (variables Vercel).
// Ne fait rien si ces variables sont absentes ou si un directeur existe
// déjà : un compte existant n'est jamais modifié ni réinitialisé.
import "dotenv/config";
import { adaptateurPg } from "../src/lib/connexion";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashMotDePasse } from "../src/lib/auth";

async function main() {
  const email = process.env.DIRECTEUR_EMAIL?.trim().toLowerCase();
  // Le nom en minuscules est aussi accepté (saisie possible dans Vercel).
  const motDePasse = process.env.DIRECTEUR_MOT_DE_PASSE ?? process.env.directeur_mot_de_passe;
  if (!email || !motDePasse) {
    console.log("Premier directeur : DIRECTEUR_EMAIL / DIRECTEUR_MOT_DE_PASSE absents, rien à faire.");
    return;
  }
  if (motDePasse.length < 12) {
    console.error("Premier directeur : mot de passe trop court (12 caractères minimum), compte non créé.");
       return;
   }

  const db = new PrismaClient({ adapter: adaptateurPg() });
  try {
    if (await db.utilisateur.findFirst({ where: { role: "OWNER" } })) {
      console.log("Premier directeur : un directeur existe déjà, rien à faire.");
      return;
    }
    if (await db.utilisateur.findUnique({ where: { email } })) {
      console.log("Premier directeur : cet e-mail a déjà un compte, rien à faire.");
      return;
    }
    const compte = await db.utilisateur.create({
      data: { email, passwordHash: await hashMotDePasse(motDePasse), role: "OWNER", actif: true },
    });
    await db.journalAudit.create({
      data: { acteur: "systeme", action: "COMPTE_CREE_AU_DEPLOIEMENT", entite: "Utilisateur", entiteId: compte.id, details: { email: compte.email, role: "OWNER" } },
    });
    console.log(`Premier directeur créé : ${compte.email}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

