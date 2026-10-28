// Règles métier vérifiées contre une vraie base PostgreSQL de test.
// DATABASE_URL doit désigner une base dont le nom contient « test » : elle
// est vidée entre les tests.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { table } from "@/lib/connexion";
import { db, ConflitDeVersion, enregistrerRdv, historiserRdv } from "@/lib/db";
import {
  calculerPrix,
  conflitsOperateur,
  creerRendezVous,
  deplacerRendezVous,
  suppressionDefinitivePossible,
  trouverRendezVous,
} from "@/lib/rendezVous";
import { creneauxDisponibles } from "@/lib/disponibilites";
import { enregistrerPaiement, libererReservation } from "@/lib/paiement";
import { appliquerActionWorkflow } from "@/lib/workflow";
import { dateParis, decalerJour, jourParis, jourSemaineParis } from "@/lib/heure";
import { ANGLES_PHOTO } from "@/lib/types";
import { semerCatalogue } from "../prisma/catalogue";
import { POST as reserver } from "@/app/api/reservation/route";

if (!/test/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Les tests exigent une base de test : DATABASE_URL doit contenir « test ».");
}

async function viderDonnees() {
  const tables = ["JournalAudit", "Sms", "AffectationCandidat", "RendezVousOption", "Devis", "RendezVous", "Vehicule", "Adresse", "Client", "Utilisateur", "Operateur"];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map(table).join(", ")} CASCADE`);
}

// Prochain jour (à au moins 2 jours d'ici) dont le jour de la semaine à Paris est donné.
function prochain(jourSemaine: number) {
  let jour = decalerJour(jourParis(new Date()), 2);
  while (jourSemaineParis(dateParis(jour, "12:00")) !== jourSemaine) jour = decalerJour(jour, 1);
  return jour;
}

// Horaires laissés au défaut du schéma (08:30–18:00) : le jour où ils
// changent, les tests de créneaux suivent la réalité au lieu de figer
// l'ancienne journée.
async function operateur(id = "op-test") {
  return db.operateur.create({ data: { id, prenom: "Test", nom: "Opérateur", telephone: "0600000001" } });
}

async function clientAvecVehicule(categorie: "BERLINE" | "SUV" | "MONOSPACE" = "BERLINE") {
  return db.client.create({
    data: {
      prenom: "Camille",
      nom: "Martin",
      telephone: "0612345678",
      adresses: { create: { adresse: "12 rue Mercière", ville: "Lyon", latitude: 45.76, longitude: 4.83 } },
      vehicules: { create: { categorie } },
    },
    include: { adresses: true, vehicules: true },
  });
}

async function nouveauRdv(dateHeure = dateParis(prochain(1), "08:30"), optionIds: string[] = []) {
  const client = await clientAvecVehicule();
  const resultat = await creerRendezVous({
    clientId: client.id,
    vehiculeId: client.vehicules[0].id,
    adresseId: client.adresses[0].id,
    packId: "pack-concession",
    dateHeure,
    optionIds,
  });
  assert.ok(resultat.ok, !resultat.ok ? resultat.erreur : "");
  return resultat.valeur;
}

before(async () => {
  await semerCatalogue(db);
});
beforeEach(viderDonnees);
after(async () => {
  await viderDonnees();
  await db.$disconnect();
});

test("prix calculé côté serveur : prestation + options, quantités par siège", async () => {
  const prix = await calculerPrix("pack-concession", "BERLINE", ["option-poils-animaux", "option-shampoing-siege-bebe", "option-shampoing-siege-bebe"]);
  assert.ok(prix.ok);
  assert.equal(prix.valeur.prixTotal, 184);
  assert.equal(prix.valeur.acompte, 18.4);

   const trop = await calculerPrix("pack-concession", "BERLINE", Array(4).fill("option-shampoing-siege-bebe"));
   assert.equal(trop.ok, false);
   const inconnue = await calculerPrix("pack-concession", "BERLINE", ["option-inexistante"]);
   assert.equal(inconnue.ok, false);
  const sansTarif = await calculerPrix("pack-concession", "MONOSPACE", []);
  assert.equal(sansTarif.ok, false);
});

test("un RDV créé garde ses options, son prix figé et un historique", async () => {
  const rdv = await nouveauRdv(undefined, ["option-shampoing-siege-bebe", "option-shampoing-siege-bebe"]);
  assert.equal(rdv.prixTotal, 159);
  assert.equal(rdv.statut, "EN_ATTENTE");
  const options = await db.rendezVousOption.findMany({ where: { rendezVousId: rdv.id } });
  assert.equal(options.length, 1);
  assert.equal(options[0].quantite, 2);
  assert.equal(rdv.historique.length, 1);
});

test("verrou optimiste : une modification concurrente n'écrase rien", async () => {
  const rdv = await nouveauRdv();
  const copieA = (await trouverRendezVous(rdv.id))!;
  const copieB = (await trouverRendezVous(rdv.id))!;
  copieA.notes = "modifié par A";
  await enregistrerRdv(copieA);
  copieB.notes = "modifié par B";
  await assert.rejects(enregistrerRdv(copieB), ConflitDeVersion);
  assert.equal((await trouverRendezVous(rdv.id))!.notes, "modifié par A");
});

test("l'historique ne fait que s'allonger, même après un enregistrement", async () => {
  const rdv = await nouveauRdv();
  await historiserRdv(rdv, "premier ajout");
  const copie = (await trouverRendezVous(rdv.id))!;
  await historiserRdv({ id: rdv.id, historique: [] }, "ajout concurrent");
  copie.notes = "note";
  await enregistrerRdv(copie);
  const final = (await trouverRendezVous(rdv.id))!;
  assert.deepEqual(
    final.historique.map((h) => h.libelle),
    ["Rendez-vous créé.", "premier ajout", "ajout concurrent"]
  );
});

test("créneaux : un seul départ le dimanche, deux le samedi, créneau pris retiré", async () => {
  await operateur();
  // Le dimanche n'est plus fermé : une ouverture exceptionnelle, à 10 h, et
  // un seul rendez-vous — pas une journée de travail ordinaire.
  assert.deepEqual(await creneauxDisponibles(prochain(0), 70), ["10:00"]);
  assert.deepEqual(await creneauxDisponibles(prochain(6), 70), ["09:00", "12:00"]);
  const lundi = prochain(1);
  assert.deepEqual(await creneauxDisponibles(lundi, 70), ["08:30", "11:30", "15:00"]);
  await nouveauRdv(dateParis(lundi, "08:30"));
  assert.deepEqual(await creneauxDisponibles(lundi, 70), ["11:30", "15:00"]);
});

test("réservation en ligne : deux clients sur le même créneau, un seul l'obtient", async () => {
  await operateur();
  const jour = prochain(2);
  const demande = (telephone: string) =>
    reserver(
      new Request("http://localhost/api/reservation", {
        method: "POST",
        body: JSON.stringify({
          packId: "pack-concession",
          categorie: "BERLINE",
          optionIds: [],
          jour,
          heure: "11:30",
          prenom: "Client",
          nom: telephone,
          telephone,
          adresse: "1 rue de la République",
          ville: "Lyon",
        }),
      })
    );
  const reponses = await Promise.all([demande("0611111111"), demande("0622222222")]);
  assert.deepEqual(reponses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await db.rendezVous.count({ where: { statut: { not: "ANNULE" } } }), 1);
});

test("paiement Stripe enregistré une seule fois (retour client + webhook simultanés)", async () => {
  const rdv = await nouveauRdv();
  await db.rendezVous.update({ where: { id: rdv.id }, data: { acompteStatut: "EN_ATTENTE_PAIEMENT" } });
  await Promise.all([enregistrerPaiement(rdv.id, "cs_test_1"), enregistrerPaiement(rdv.id, "cs_test_1")]);
    const final = (await trouverRendezVous(rdv.id))!;
    assert.equal(final.acompteStatut, "PAYE");
    assert.equal(await db.sms.count({ where: { rendezVousId: rdv.id, motif: "CONFIRMATION_RDV" } }), 1);
    assert.equal(await db.journalAudit.count({ where: { entiteId: rdv.id, action: "ACOMPTE_PAYE" } }), 1);

  // Un RDV payé n'est jamais libéré par l'expiration du paiement.
  await libererReservation(rdv.id, "expiration");
  assert.notEqual((await trouverRendezVous(rdv.id))!.statut, "ANNULE");
});

test("workflow opérateur : photos et signatures obligatoires avant la clôture", async () => {
  const cree = await nouveauRdv();
  await db.rendezVous.update({ where: { id: cree.id }, data: { statut: "CONFIRME", version: { increment: 1 } }});
  const rdv = (await trouverRendezVous(cree.id))!;
  const faire = async (action: Parameters<typeof appliquerActionWorkflow>[1]) => appliquerActionWorkflow(rdv, action);
  const signature = "data:image/png;base64,AAAA";

    assert.ok((await faire({ type: "DEMARRER_ROUTE" })).ok);
    assert.ok((await faire({ type: "CONFIRMER_ARRIVEE" })).ok);
    assert.equal((await faire({ type: "PASSER_PHOTOS_AVANT" })).ok, false); // signature manquante
    assert.ok((await faire({ type: "SIGNATURE_CONTROLE", dataUrl: signature })).ok);
    assert.ok((await faire({ type: "PASSER_PHOTOS_AVANT" })).ok);
    assert.equal((await faire({ type: "PASSER_LAVAGE" })).ok, false); // photos manquantes
    for (const angle of ANGLES_PHOTO) assert.ok((await faire({ type: "PHOTO_AVANT", angle })).ok);
    assert.ok((await faire({ type: "PASSER_LAVAGE" })).ok);
    assert.ok((await faire({ type: "TERMINER_LAVAGE" })).ok);
    assert.equal((await faire({ type: "SIGNATURE_FIN", dataUrl: signature })).ok, false); // photos après manquantes
    for (const angle of ANGLES_PHOTO) assert.ok((await faire({ type: "PHOTO_APRES", angle })).ok);
    assert.ok((await faire({ type: "SIGNATURE_FIN", dataUrl: signature })).ok);
    assert.ok((await faire({ type: "PASSER_PAIEMENT" })).ok);
    assert.ok((await faire({ type: "CHOISIR_MODE_PAIEMENT", mode: "CARTE" })).ok);
    assert.equal((await faire({ type: "CONFIRMER_PAIEMENT" })).ok, false); // lien non envoyé
    assert.ok((await faire({ type: "CHOISIR_MODE_PAIEMENT", mode: "ESPECES" })).ok);
    assert.ok((await faire({ type: "CONFIRMER_PAIEMENT" })).ok);

  const final = (await trouverRendezVous(cree.id))!;
  assert.equal(final.statut, "TERMINE");
  assert.match(final.numeroFacture ?? "", /^XD-\d{4}-/);
  assert.ok(final.photosAvant.every((p) => p.prise) && final.photosApres.every((p) => p.prise));
});

test("décalage : la journée va jusqu'à 18h, donc le départ de 15h reste ouvert pour 3 h", async () => {
  await operateur();
  const lundi = prochain(1);
  // 15h + 3 h = 18h pile : le créneau n'existe que si la journée finit à 18h.
  assert.ok((await creneauxDisponibles(lundi, 180)).includes("15:00"));
  await db.operateur.update({ where: { id: "op-test" }, data: { heureFin: "17:30" } });
  assert.ok(!(await creneauxDisponibles(lundi, 180)).includes("15:00"));
});

test("décalage : le chevauchement avec la tournée de l'opérateur est détecté", async () => {
  const op = await operateur();
  const lundi = prochain(1);
  const matin = await nouveauRdv(dateParis(lundi, "08:30"));
  const apresMidi = await nouveauRdv(dateParis(lundi, "15:00"));
  for (const r of [matin, apresMidi]) {
    await db.rendezVous.update({ where: { id: r.id }, data: { operateurId: op.id, dureeMinutes: 180 } });
  }

    // 13h + 3 h mord sur le rendez-vous de 15h...
    const conflits = await conflitsOperateur(op.id, dateParis(lundi, "13:00"), 180, matin.id);
    assert.deepEqual(conflits.map((c) => c.id), [apresMidi.id]);
    // ...alors que 11h30 + 3 h s'arrête juste avant.
    assert.equal((await conflitsOperateur(op.id, dateParis(lundi, "11:30"), 180, matin.id)).length, 0);

    // Le décalage effectif laisse une trace datée dans l'historique.
    const frais = await trouverRendezVous(matin.id);
    await deplacerRendezVous(frais!, dateParis(lundi, "11:30"));
    const relu = await trouverRendezVous(matin.id);
    assert.equal(relu!.dateHeure.getTime(), dateParis(lundi, "11:30").getTime());
    assert.ok(relu!.historique.some((h) => /^Déplacé du .* au /.test(h.libelle)));
});

test("suppression définitive refusée dès qu'il y a une pièce comptable", () => {
  const nu = { numeroFacture: null, acompteStatut: null, paiementConfirmeAt: null };
  assert.ok(suppressionDefinitivePossible(nu));
  assert.ok(!suppressionDefinitivePossible({ ...nu, numeroFacture: "F2026-0001" }));
  assert.ok(!suppressionDefinitivePossible({ ...nu, acompteStatut: "PAYE" }));
  assert.ok(!suppressionDefinitivePossible({ ...nu, paiementConfirmeAt: new Date() }));
  // Un acompte seulement en attente n'engage rien : le RDV reste supprimable.
  assert.ok(suppressionDefinitivePossible({ ...nu, acompteStatut: "EN_ATTENTE_PAIEMENT" }));
});
