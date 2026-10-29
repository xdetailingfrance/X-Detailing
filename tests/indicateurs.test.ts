// Indicateurs du tableau de bord : réservé, réalisé, encaissé vérifié,
// déclaré et reste à recevoir ne sont jamais confondus.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { table } from "@/lib/connexion";
import { db } from "@/lib/db";
import { bornesPeriode, indicateurs } from "@/lib/indicateurs";
import { dateParis, jourParis } from "@/lib/heure";
import { photosInitiales } from "@/lib/types";
import { semerCatalogue } from "../prisma/catalogue";

if (!/test/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Les tests exigent une base de test : DATABASE_URL doit contenir « test ».");
}

async function vider() {
  const tables = ["JournalAudit", "Sms", "AffectationCandidat", "RendezVousOption", "Devis", "RendezVous", "Vehicule", "Adresse", "Client", "Utilisateur", "Operateur"];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map(table).join(", ")} CASCADE`);
}

before(async () => {
  await vider();
  await semerCatalogue(db);
  const client = await db.client.create({
    data: { prenom: "A", nom: "B", telephone: "0600000009", adresses: { create: { adresse: "1 rue", ville: "Bordeaux"} }, vehicules: { create: { categorie: "BERLINE" } } },
    include: { adresses: true, vehicules: true },
  });
  const base = {
    clientId: client.id,
    vehiculeId: client.vehicules[0].id,
    adresseId: client.adresses[0].id,
    packId: "pack-concession",
    categorieVehicule: "BERLINE" as const,
    dateHeure: new Date(Date.now() - 3600000),
    dureeMinutes: 70,
    prixTotal: 100,
    acompte: 10,
    photosAvant: photosInitiales(),
    photosApres: photosInitiales(),
    historique: [],
  };
  // 1 : terminé, acompte Stripe payé, solde déclaré en espèces.
  await db.rendezVous.create({ data: { ...base, suiviToken: "t1", statut: "TERMINE", acompteStatut: "PAYE", modePaiement: "ESPECES", paiementConfirmeAt: new Date() } });
  // 2 : terminé, carte déclarée sans acompte.
  await db.rendezVous.create({ data: { ...base, suiviToken: "t2", statut: "TERMINE", modePaiement: "CARTE", paiementConfirmeAt: new Date() } });
  // 3 : terminé, pas encore réglé.
  await db.rendezVous.create({ data: { ...base, suiviToken: "t3", statut: "TERMINE" } });
  // 4 : confirmé à venir, acompte payé.
  await db.rendezVous.create({ data: { ...base, suiviToken: "t4", statut: "CONFIRME", acompteStatut: "PAYE" } });
  // 5 : annulé, ignoré partout.
  await db.rendezVous.create({ data: { ...base, suiviToken: "t5", statut: "ANNULE", acompteStatut: "PAYE" } });
});
after(async () => {
  await vider();
  await db.$disconnect();
});

test("réservé, réalisé, encaissé vérifié, déclaré et reste à recevoir", async () => {
  const k = await indicateurs({ periode: "jour" });
  assert.equal(k.caReserve, 400);
  assert.equal(k.caRealise, 300);
  assert.equal(k.encaisseVerifie, 20); // acomptes Stripe des RDV 1 et 4
  assert.equal(k.declareEspeces, 90); // 100 − acompte payé
  assert.equal(k.declareCarte, 100);
  assert.equal(k.resteARecevoir, 100); // RDV 3
  assert.equal(k.nbTermines, 3);
});

test("bornes des périodes en heure de Paris", () => {
  const instant = new Date("2026-10-31T23:30:00.000Z"); // 1er novembre à Paris
  const mois = bornesPeriode({ periode: "mois" }, instant);
  assert.equal(jourParis(mois.debut), "2026-11-01");
  assert.equal(mois.fin.toISOString(), dateParis("2026-12-01").toISOString());
  const perso = bornesPeriode({ periode: "personnalisee", du: "2026-10-01", au: "2026-10-31" });
  assert.equal(perso.fin.toISOString(), dateParis("2026-11-01").toISOString());
});

