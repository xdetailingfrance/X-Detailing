// Règles métier vérifiées contre une vraie base PostgreSQL de test.
// DATABASE_URL doit désigner une base dont le nom contient « test » : elle
// est vidée entre les tests.
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { table } from "@/lib/connexion";
import { obstacleSuppressionClient } from "@/lib/clients";
import { factureParId, lignesFacture, reglement } from "@/lib/facturation";
import { fraisDeplacement, DISTANCE_MAX_TARIFEE } from "@/lib/deplacement";
import { db, ConflitDeVersion, enregistrerRdv, historiserRdv } from "@/lib/db";
import {
  calculerPrix,
  conflitsOperateur,
  creerRendezVous,
  deplacerRendezVous,
  suppressionDefinitivePossible,
  trouverRendezVous,
} from "@/lib/rendezVous";
import { creneauxDisponibles, DELAI_MINIMUM_MINUTES } from "@/lib/disponibilites";
import { DUREE_BLOCAGE_MINUTES, enregistrerPaiement, libererReservation } from "@/lib/paiement";
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
      adresses: { create: { adresse: "Place de la Bourse", ville: "Bordeaux", latitude: 44.8412, longitude: -0.5696 } },
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
          ville: "Bordeaux",
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

test("un créneau libre se réserve jusqu'au délai minimum avant le départ, pas en deçà", async () => {
  await operateur();
  const lundi = prochain(1);
  const depart = dateParis(lundi, "08:30");

    // L'horloge est pilotée : à 20 h un soir d'octobre, aucun créneau du jour
    // n'est à portée de la borne qu'on veut éprouver.
    const a = (minutesAvant: number) => new Date(depart.getTime() - minutesAvant * 60000);
    try {
      mock.timers.enable({ apis: ["Date"], now: a(DELAI_MINIMUM_MINUTES + 1) });
      assert.ok((await creneauxDisponibles(lundi, 150)).includes("08:30"), "31 min avant : encore réservable");

      mock.timers.setTime(a(DELAI_MINIMUM_MINUTES - 1).getTime());
      assert.ok(!(await creneauxDisponibles(lundi, 150)).includes("08:30"), "29 min avant : trop tard");
    } finally {
      mock.timers.reset();
    }
});

test("le dernier créneau réservable laisse le temps de payer avant le départ", () => {
  // Stripe impose un plancher de 30 min à l'expiration d'une session
  // Checkout : si on pouvait réserver à moins que cela du départ, l'acompte
  // se finaliserait après l'heure de la prestation.
  assert.ok(
    DELAI_MINIMUM_MINUTES > DUREE_BLOCAGE_MINUTES,
    `réservable à ${DELAI_MINIMUM_MINUTES} min du départ alors que le paiement reste ouvert ${DUREE_BLOCAGE_MINUTES} min`
  );
});

test("barème de déplacement : par tranche, et rien d'inventé au-delà", () => {
  assert.equal(fraisDeplacement(0), 0);
  assert.equal(fraisDeplacement(10), 0);
  assert.equal(fraisDeplacement(10.1), 10);
  assert.equal(fraisDeplacement(20), 10);
  assert.equal(fraisDeplacement(25), 15);
  assert.equal(fraisDeplacement(30), 15);
  // Au-delà du barème : null, qui veut dire « tarif particulier », pas gratuit.
  assert.equal(fraisDeplacement(DISTANCE_MAX_TARIFEE + 0.1), null);
  assert.equal(fraisDeplacement(-1), null);
});

test("le déplacement entre dans le prix et dans l'acompte", async () => {
  const client = await clientAvecVehicule();
  const resultat = await creerRendezVous({
    clientId: client.id,
    vehiculeId: client.vehicules[0].id,
    adresseId: client.adresses[0].id,
    packId: "pack-concession",
    dateHeure: dateParis(prochain(1), "08:30"),
    fraisDeplacement: 10,
    distanceKm: 18.7,
  });
  assert.ok(resultat.ok, !resultat.ok ? resultat.erreur : "");
  const rdv = resultat.valeur;

    const sansRoute = await calculerPrix("pack-concession", "BERLINE", []);
    assert.ok(sansRoute.ok);
    assert.equal(rdv.prixTotal, sansRoute.valeur.prixTotal + 10);
    assert.equal(rdv.fraisDeplacement, 10);
    assert.equal(rdv.distanceKm, 18.7);
    // L'acompte porte sur le total payé, déplacement compris.
    assert.equal(rdv.acompte, Math.round(rdv.prixTotal * 10) / 100);
});

test("une fiche client ne s'efface pas quand elle porte une facture", async () => {
  const client = await clientAvecVehicule();
  assert.equal(await obstacleSuppressionClient(client.id), null);

    const resultat = await creerRendezVous({
      clientId: client.id,
      vehiculeId: client.vehicules[0].id,
      adresseId: client.adresses[0].id,
      packId: "pack-concession",
      dateHeure: dateParis(prochain(1), "08:30"),
    });
    assert.ok(resultat.ok, !resultat.ok ? resultat.erreur : "");
    // Un rendez-vous sans trace comptable ne retient pas la fiche.
    assert.equal(await obstacleSuppressionClient(client.id), null);

    await db.rendezVous.update({ where: { id: resultat.valeur.id }, data: { numeroFacture: "F2026-0001" } });
    assert.match((await obstacleSuppressionClient(client.id)) ?? "", /facturé ou payé/);
});

test("une facture détaille le total sans jamais s'en écarter", async () => {
  const op = await operateur();
  const client = await clientAvecVehicule("SUV");
  const options = await db.option.findMany({ take: 2 });
  const resultat = await creerRendezVous({
    clientId: client.id,
    vehiculeId: client.vehicules[0].id,
    adresseId: client.adresses[0].id,
    packId: "pack-concession-luxe",
    dateHeure: dateParis(prochain(1), "08:30"),
    optionIds: options.map((o) => o.id),
    fraisDeplacement: 10,
    distanceKm: 18.7,
  });
  assert.ok(resultat.ok, !resultat.ok ? resultat.erreur : "");
  await db.rendezVous.update({
    where: { id: resultat.valeur.id },
    data: {
      operateurId: op.id,
      statut: "TERMINE",
      numeroFacture: "XD-2026-TEST01",
      modePaiement: "CARTE",
      paiementConfirmeAt: new Date(),
      acompteStatut: "PAYE",
    },
  });

    const facture = await factureParId(resultat.valeur.id);
    assert.ok(facture);
    const lignes = lignesFacture(facture);
    // Prestation + chaque option + déplacement : la somme des lignes vaut le
    // total du dossier. Une facture dont le détail ne reconstitue pas le
    // montant facturé est une facture contestable.
    const somme = Math.round(lignes.reduce((s, l) => s + l.total, 0) * 100) / 100;
    assert.equal(somme, facture.prixTotal);
    assert.ok(lignes.some((l) => /Déplacement/.test(l.libelle)));
    assert.equal(lignes.filter((l) => !/Déplacement/.test(l.libelle)).length, 1 + options.length);

    // Acompte encaissé déduit, solde = le reste.
    const regle = reglement(facture);
    assert.equal(Math.round((regle.acompte + regle.solde) * 100) / 100, facture.prixTotal);
});

test("un dossier sans facture n'en est pas une", async () => {
  const rdv = await nouveauRdv();
  assert.equal(await factureParId(rdv.id), null);
});
