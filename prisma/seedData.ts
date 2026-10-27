// Jeu de DÉMONSTRATION (jamais de vraies données) : opérateurs, comptes,
// clients, rendez-vous de la semaine et devis. Tous les identifiants
// commencent par « demo- » et les e-mails se terminent par
// « @demo.xdetailing.fr », pour qu'on puisse toujours les distinguer des
// données réelles et les supprimer d'un coup (supprimerDemo).
import type { PrismaClient } from "../src/generated/prisma/client";
import { hashMotDePasse } from "../src/lib/auth";
import { dateParis, decalerJour, jourParis } from "../src/lib/heure";
import { photosInitiales } from "../src/lib/types";
import { semerCatalogue } from "./catalogue";

export const MOT_DE_PASSE_DEMO = "xdetailing-demo-2024";
export const DOMAINE_DEMO = "demo.xdetailing.fr";

const historique = (libelle: string) => [{ horodatage: new Date().toISOString(), libelle }];

export async function semerDemo(db: PrismaClient) {
  await semerCatalogue(db);
  const hash = await hashMotDePasse(MOT_DE_PASSE_DEMO);

  const operateurs = [
    { id: "demo-operateur-mathieu", prenom: "Mathieu", nom: "Caumeil", telephone: "0600000000", secteurId: "secteur-lyon-centre", adresseDomicile: "1 place Bellecour, Lyon", latitudeDomicile: 45.7578, longitudeDomicile: 4.832,kangooImmatriculation: "XD-001-OS" },
    { id: "demo-operateur-karim", prenom: "Karim", nom: "B.", telephone: "0611111111", secteurId: "secteur-lyon-centre", adresseDomicile: "12 rue de la République, Lyon", latitudeDomicile: 45.764, longitudeDomicile: 4.8357, kangooImmatriculation: "AB-123-CD" },
    { id: "demo-operateur-sofia", prenom: "Sofia", nom: "M.", telephone: "0622222222", secteurId: "secteur-lyon-centre", adresseDomicile: "5 quai Saint-Antoine, Lyon", latitudeDomicile: 45.759, longitudeDomicile: 4.827, kangooImmatriculation: "EF-456-GH" },
    { id: "demo-operateur-yanis", prenom: "Yanis", nom: "T.", telephone: "0633333333", secteurId: "secteur-villeurbanne", adresseDomicile: "20 cours Émile Zola, Villeurbanne", latitudeDomicile: 45.7667, longitudeDomicile: 4.8803, kangooImmatriculation: "IJ-789-KL" },
  ];
  for (const o of operateurs) {
    await db.operateur.upsert({ where: { id: o.id }, update: {}, create: { ...o, heureDebut: "08:30", heureFin:"17:30" } });
  }

  const comptes = [
    { id: "demo-user-directeur", email: `directeur@${DOMAINE_DEMO}`, role: "OWNER" as const, operateurId: "demo-operateur-mathieu" },
    { id: "demo-user-responsable", email: `responsable@${DOMAINE_DEMO}`, role: "RESPONSABLE" as const, operateurId: null },
    { id: "demo-user-commercial", email: `commercial@${DOMAINE_DEMO}`, role: "COMMERCIAL" as const, operateurId:null },
    { id: "demo-user-comptable", email: `comptable@${DOMAINE_DEMO}`, role: "COMPTABLE" as const, operateurId: null },
    { id: "demo-user-karim", email: `karim@${DOMAINE_DEMO}`, role: "OPERATEUR" as const, operateurId: "demo-operateur-karim" },
    { id: "demo-user-sofia", email: `sofia@${DOMAINE_DEMO}`, role: "OPERATEUR" as const, operateurId: "demo-operateur-sofia" },
    { id: "demo-user-yanis", email: `yanis@${DOMAINE_DEMO}`, role: "OPERATEUR" as const, operateurId: "demo-operateur-yanis" },
  ];
  for (const c of comptes) {
    await db.utilisateur.upsert({ where: { id: c.id }, update: {}, create: { ...c, passwordHash: hash } });
  }

  const clients = [
    {
      id: "demo-client-julien",
      prenom: "Julien",
      nom: "Dupont",
      telephone: "0700000000",
      email: "julien.dupont@example.com",
      adresse: { id: "demo-adresse-julien", libelle: "Domicile", adresse: "18 rue Victor Hugo", ville: "Lyon", codePostal: "69002", latitude: 45.7558, longitude: 4.8322 },
      vehicule: { id: "demo-vehicule-julien", categorie: "BERLINE" as const, marque: "Peugeot", modele: "308", immatriculation: "AA-111-BB" },
    },
    {
      id: "demo-client-nadia",
      prenom: "Nadia",
      nom: "Leroy",
      telephone: "0711111111",
      email: "nadia.leroy@example.com",
      adresse: { id: "demo-adresse-nadia", libelle: "Bureau", adresse: "45 avenue Roger Salengro", ville: "Villeurbanne", codePostal: "69100", latitude: 45.7719, longitude: 4.8902 },
      vehicule: { id: "demo-vehicule-nadia", categorie: "SUV" as const, marque: "Peugeot", modele: "3008", immatriculation: "CC-222-DD" },
    },
  ];
  for (const { adresse, vehicule, ...client } of clients) {
    await db.client.upsert({
      where: { id: client.id },
      update: {},
      create: { ...client, adresses: { create: adresse }, vehicules: { create: vehicule } },
    });
  }

  // Planning de la semaine, dates relatives à aujourd'hui (heure de Paris).
  const aujourdhui = jourParis(new Date());
  const rdvs = [
    { id: "demo-rdv-julien-j0", client: clients[0], pack: "pack-concession", operateurId: "demo-operateur-mathieu", jours: 0, heure: "14:00", statut: "CONFIRME" as const },
    { id: "demo-rdv-karim-j0", client: clients[1], pack: "pack-concession-luxe", operateurId: "demo-operateur-karim", jours: 0, heure: "09:00", statut: "CONFIRME" as const },
    { id: "demo-rdv-sofia-j1", client: clients[0], pack: "pack-concession", operateurId: "demo-operateur-sofia",jours: 1, heure: "10:00", statut: "CONFIRME" as const },
    { id: "demo-rdv-yanis-j1", client: clients[1], pack: "pack-concession-luxe", operateurId: "demo-operateur-yanis", jours: 1, heure: "15:00", statut: "CONFIRME" as const },
    { id: "demo-rdv-mathieu-j2", client: clients[1], pack: "pack-concession-luxe", operateurId: "demo-operateur-mathieu", jours: 2, heure: "11:30", statut: "CONFIRME" as const },
    { id: "demo-rdv-karim-j3", client: clients[0], pack: "pack-concession", operateurId: "demo-operateur-karim",jours: 3, heure: "15:00", statut: "CONFIRME" as const },
    { id: "demo-rdv-non-affecte-j4", client: clients[1], pack: "pack-concession-luxe", operateurId: null, jours:4, heure: "15:00", statut: "EN_ATTENTE" as const },
  ];
  for (const r of rdvs) {
    const pack = await db.pack.findUniqueOrThrow({ where: { id: r.pack }, include: { tarifs: true } });
    const prix = pack.tarifs.find((t) => t.categorie === r.client.vehicule.categorie)!.prix.toNumber();
    await db.rendezVous.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        clientId: r.client.id,
        vehiculeId: r.client.vehicule.id,
        adresseId: r.client.adresse.id,
        packId: pack.id,
        categorieVehicule: r.client.vehicule.categorie,
        secteurId: r.client.adresse.ville === "Villeurbanne" ? "secteur-villeurbanne" : "secteur-lyon-centre",
        operateurId: r.operateurId,
        dateHeure: dateParis(decalerJour(aujourdhui, r.jours), r.heure),
        dureeMinutes: pack.dureeMinMinutes,
        prixTotal: prix,
        acompte: Math.round(prix * 10) / 100,
        statut: r.statut,
        source: "TELEPHONE",
        suiviToken: `${r.id}-suivi`,
        photosAvant: photosInitiales(),
        photosApres: photosInitiales(),
        historique: historique(r.operateurId ? "Rendez-vous de démonstration créé et affecté." : "Rendez-vous dedémonstration créé, en attente d'affectation."),
      },
    });
  }

  const devis = [
    {
      id: "demo-devis-claire",
      token: "demo-devis-claire-jeton",
      typeClient: "PARTICULIER" as const,
      nomClient: "Claire Martin",
      telephoneClient: "0688888888",
      emailClient: "claire.martin@example.com",
      raisonSociale: null,
      adresse: "42 avenue Jean Jaurès",
      ville: "Lyon",
      vehiculeDescription: "Renault Clio",
      categorieVehicule: "CITADINE" as const,
      packId: "pack-concession-luxe",
      optionIds: [],
      prixTotal: 189,
      acompte: 18.9,
      statut: "ENVOYE" as const,
      envoyeAt: new Date(),
    },
    {
      id: "demo-devis-nicolas",
      token: "demo-devis-nicolas-jeton",
      typeClient: "PRO" as const,
      nomClient: "Nicolas Perrin",
      telephoneClient: "0699999999",
      emailClient: "n.perrin@example.com",
      raisonSociale: "Garage Perrin SARL",
      adresse: "8 rue de la Part-Dieu",
      ville: "Lyon",
      vehiculeDescription: "Audi Q5",
      categorieVehicule: "SUV" as const,
      packId: "pack-concession-luxe",
      optionIds: ["option-poils-animaux"],
      prixTotal: 234,
      acompte: 23.4,
      statut: "ACCEPTE" as const,
      envoyeAt: new Date(),
      consulteAt: new Date(),
      accepteAt: new Date(),
    },
  ];
  for (const d of devis) {
    await db.devis.upsert({
      where: { id: d.id },
      update: {},
      create: { ...d, creeParUtilisateurId: "demo-user-commercial", historique: historique("Devis de démonstration créé.") },
    });
  }

  return { operateurs: operateurs.length, comptes: comptes.map((c) => c.email), clients: clients.length, rendezVous: rdvs.length, devis: devis.length };
}

// Supprime toutes les données de démonstration (identifiants « demo- »),
// sans toucher aux données réelles ni au catalogue.
export async function supprimerDemo(db: PrismaClient) {
  const demo = { startsWith: "demo-" };
  // Un vrai RDV confié à un opérateur de démo est conservé, sans opérateur.
  await db.rendezVous.updateMany({ where: { operateurId: demo, NOT: { id: demo } }, data: { operateurId: null }});
  await db.affectationCandidat.deleteMany({ where: { operateurId: demo } });
  await db.sms.deleteMany({ where: { rendezVousId: demo } });
  await db.devis.deleteMany({ where: { OR: [{ id: demo }, { creeParUtilisateurId: demo }] } });
  await db.rendezVous.deleteMany({ where: { OR: [{ id: demo }, { clientId: demo }] } });
  await db.client.deleteMany({ where: { id: demo } });
  await db.utilisateur.deleteMany({ where: { id: demo } });
  await db.operateur.deleteMany({ where: { id: demo } });
}

