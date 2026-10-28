// Catalogue réel de X Detailing : prestations, grille de prix, options et
// secteurs. Ce sont de vraies données (pas de la démonstration) : à
// charger une fois en production avec `npm run db:catalogue`. Idempotent :
// relancer le script ne crée pas de doublon et ne modifie pas un prix déjà
// changé dans le back-office.
import type { PrismaClient } from "../src/generated/prisma/client";

const PACKS = [
  {
    id: "pack-concession",
    nom: "Concession",
    description:
      "Surfaces plastiques, aspiration habitacle/coffre, seuils de porte, vitrerie intérieure, " +
      "shampoing sièges/tapis/moquettes, cuir/alcantara, finition plastiques et parfum.",
    dureeMinMinutes: 70,
    dureeMaxMinutes: 105,
    tarifs: { CITADINE: 129, BERLINE: 139, SUV: 149 },
  },
  {
    id: "pack-concession-luxe",
    nom: "Concession Luxe",
    description:
      "Pack Concession inclus + nettoyage extérieur, passages de roues, pré-lavage mousse active, " +
      "lavage manuel, ouvrants, séchage premium, pneus, finition showroom et contrôle qualité.",
    dureeMinMinutes: 150,
    dureeMaxMinutes: 180,
    tarifs: { CITADINE: 189, BERLINE: 199, SUV: 209 },
  },
] as const;

// Options du site X Detailing, par rubrique et dans l'ordre d'affichage.
const OPTIONS: { id: string; groupe: string; nom: string; prix: number; unite?: string; quantiteMax?: number }[]= [
  { id: "option-vehicule-non-vide", groupe: "État du véhicule", nom: "Véhicule non vidé", prix: 15 },
  { id: "option-sable", groupe: "État du véhicule", nom: "Présence de sable", prix: 20 },
  { id: "option-poils-animaux", groupe: "État du véhicule", nom: "Poils d'animaux", prix: 25 },
  { id: "option-shampoing-coffre", groupe: "Shampoing approfondi", nom: "Shampoing du coffre", prix: 20 },
  { id: "option-shampoing-siege-bebe", groupe: "Shampoing approfondi", nom: "Shampoing siège auto bébé", prix: 10, unite: "siège", quantiteMax: 3 },
  { id: "option-shampoing-plafonnier", groupe: "Shampoing approfondi", nom: "Shampoing plafonnier (ciel de toit)", prix: 60 },
  { id: "option-cuir", groupe: "Traitement du cuir", nom: "Traitement du cuir", prix: 50 },
  { id: "option-cuir-hors-sieges", groupe: "Traitement du cuir", nom: "Traitement du cuir, hors sièges", prix: 25},
  { id: "option-tapis-supplementaire", groupe: "Tapis et coffre", nom: "Tapis supplémentaire", prix: 20 },
  { id: "option-tapis-coffre", groupe: "Tapis et coffre", nom: "Tapis de coffre", prix: 15 },
  { id: "option-sous-coffre", groupe: "Tapis et coffre", nom: "Sous-coffre", prix: 25 },
];

const SECTEURS = [
  { id: "secteur-bordeaux-centre", nom: "Bordeaux Centre", ville: "Bordeaux" },
  { id: "secteur-bordeaux-rive-droite", nom: "Bordeaux Rive Droite", ville: "Bordeaux" },
];

export async function semerCatalogue(db: PrismaClient) {
  for (const secteur of SECTEURS) {
    // On met à jour le nom : un secteur renommé doit suivre, sinon la base garde
    // indéfiniment l'ancienne ville sous un identifiant qui ne lui correspond plus.
    await db.secteur.upsert({
      where: { id: secteur.id },
      update: { nom: secteur.nom, ville: secteur.ville },
      create: secteur,
    });
  }

  // Secteurs retirés du catalogue : supprimés, mais seulement s'ils ne servent
  // plus à personne. Les laisser les rendrait éternellement sélectionnables à la
  // création d'un opérateur ; les supprimer sans vérifier effacerait l'historique.
  const gardes = SECTEURS.map((s) => s.id);
  const anciens = await db.secteur.findMany({
    where: { id: { notIn: gardes } },
    include: { _count: { select: { operateurs: true, rendezVous: true } } },
  });
  for (const ancien of anciens) {
    if (ancien._count.operateurs === 0 && ancien._count.rendezVous === 0) {
      await db.secteur.delete({ where: { id: ancien.id } });
    }
  }
  for (const { tarifs, ...pack } of PACKS) {
    await db.pack.upsert({ where: { id: pack.id }, update: {}, create: pack });
    for (const [categorie, prix] of Object.entries(tarifs)) {
      await db.packTarif.upsert({
        where: { packId_categorie: { packId: pack.id, categorie: categorie as keyof typeof tarifs } },
        update: {},
        create: { packId: pack.id, categorie: categorie as keyof typeof tarifs, prix },
      });
    }
  }
  for (const [ordre, option] of OPTIONS.entries()) {
    await db.option.upsert({
      where: { id: option.id },
      update: {},
      create: { ...option, unite: option.unite ?? null, quantiteMax: option.quantiteMax ?? null, ordre },
    });
  }
    return { secteurs: SECTEURS.length, prestations: PACKS.length, options: OPTIONS.length };
}

