// Outils de Lola exécutés contre la base de test (avec les données de
// démonstration) : mêmes règles que le back-office, mêmes droits par rôle.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { table } from "@/lib/connexion";
import { db } from "@/lib/db";
import { executerOutil, type ContexteOutils } from "@/lib/lolaOutils";
import { decalerJour, jourParis } from "@/lib/heure";
import { semerDemo } from "../prisma/seedData";
import type { SessionPayload } from "@/lib/auth";

if (!/test/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Les tests exigent une base de test : DATABASE_URL doit contenir « test ».");
}

const directeur: SessionPayload = { sub: "demo-user-directeur", role: "OWNER", operateurId: "demo-operateur-mathieu", email: "directeur@demo.xdetailing.fr" };
const commercial: SessionPayload = { sub: "demo-user-commercial", role: "COMMERCIAL", operateurId: null, email:"commercial@demo.xdetailing.fr" };

function contexte(session: SessionPayload): ContexteOutils {
  return { session, rdvTouches: new Set(), smsEnvoyes: [], modifie: false };
}

async function outil(nom: string, entree: object, session = directeur) {
  const { contenu, erreur } = await executerOutil(nom, entree, contexte(session));
  return { resultat: erreur ? contenu : JSON.parse(contenu), erreur };
}

async function vider() {
  const tables = ["JournalAudit", "Sms", "AffectationCandidat", "RendezVousOption", "Devis", "RendezVous", "Vehicule", "Adresse", "Client", "Utilisateur", "Operateur"];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map(table).join(", ")} CASCADE`);
}

before(async () => {
  await vider();
  await semerDemo(db);
});
after(async () => {
  await vider();
  await db.$disconnect();
});

test("lecture : clients, planning, opérateurs, catalogue, devis, SMS", async () => {
  const clients = await outil("rechercher_clients", { recherche: "nadia" });
  assert.equal(clients.resultat.length, 1);
  assert.equal(clients.resultat[0].vehicules[0].categorie, "SUV");
  assert.equal((await outil("rechercher_clients", { recherche: "07 11 11" })).resultat.length, 1);

   const aujourdhui = jourParis(new Date());
   const planning = await outil("lister_rendez_vous", { du: aujourdhui, au: decalerJour(aujourdhui, 6) });
   assert.equal(planning.erreur, false);
   assert.equal(planning.resultat.length, 7);

  const operateurs = await outil("lister_operateurs", {});
  assert.equal(operateurs.resultat.length, 4);
  const catalogue = await outil("catalogue", {});
  assert.equal(catalogue.resultat.packs[0].prixParCategorie.BERLINE, 139);
  assert.ok(catalogue.resultat.options.some((o: { parUnite?: string }) => o.parUnite === "siège"));
  assert.equal((await outil("lister_devis", {})).resultat.length, 2);
  assert.equal((await outil("journal_sms", {})).erreur, false);
});

test("finances réservées au directeur", async () => {
  const finances = await outil("finances", {});
  assert.equal(finances.erreur, false);
  assert.equal(typeof finances.resultat.caMois, "number");
  assert.equal((await outil("finances", {}, commercial)).erreur, true);
});

test("actions : créer un client, un RDV affecté, le déplacer, l'annuler, envoyer des SMS", async () => {
  const client = await outil("creer_client", {
    prenom: "Léa",
    nom: "Bernard",
    telephone: "0644556677",
    adresse: "Place de la Bourse",
    ville: "Bordeaux",
    categorieVehicule: "CITADINE",
  });
  assert.equal(client.erreur, false);

   const jour = decalerJour(jourParis(new Date()), 5);
   const rdv = await outil("creer_rendez_vous", {
     clientId: client.resultat.clientId,
     packId: "pack-concession",
     dateHeure: `${jour}T08:30`,
     operateurId: "demo-operateur-sofia",
     envoyerSms: true,
   });
   assert.equal(rdv.erreur, false, String(rdv.resultat));
   assert.equal(rdv.resultat.rendezVous.statut, "CONFIRME");
   assert.equal(rdv.resultat.rendezVous.prixTotal, 129);
   assert.equal(rdv.resultat.rendezVous.operateur.nom, "Sofia M.");
   assert.match(rdv.resultat.rendezVous.quand, /08:30/);
   assert.equal(rdv.resultat.smsEnvoyes.length, 2);
   const id = rdv.resultat.rendezVous.id;

  const deplace = await outil("modifier_rendez_vous", { rendezVousId: id, nouvelleDateHeure: `${jour}T11:30`, envoyerSms: true });
  assert.match(deplace.resultat.rendezVous.quand, /11:30/);
  const affecte = await outil("affecter_operateur", { rendezVousId: id, operateurId: "demo-operateur-yanis", envoyerSms: false });
  assert.equal(affecte.resultat.rendezVous.operateur.nom, "Yanis T.");
  const annule = await outil("modifier_rendez_vous", { rendezVousId: id, annuler: true, envoyerSms: true });
  assert.equal(annule.resultat.rendezVous.statut, "ANNULE");

  const sms = await outil("envoyer_sms", { message: "Test", clientId: client.resultat.clientId });
  assert.equal(sms.resultat.statut, "SIMULE");
  assert.ok((await db.journalAudit.count({ where: { entiteId: id } })) >= 3);
});

test("rappels de la veille : un seul SMS par RDV", async () => {
  const demain = decalerJour(jourParis(new Date()), 1);
  const premier = await outil("envoyer_rappels", { date: demain });
  assert.equal(premier.resultat.nbEnvoyes, 2);
  const second = await outil("envoyer_rappels", { date: demain });
  assert.equal(second.resultat.nbEnvoyes, 0);
});

