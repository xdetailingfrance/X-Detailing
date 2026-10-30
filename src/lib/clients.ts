// Création de client partagée entre le formulaire du back-office
// (/api/clients) et l'assistante Lola.
import type { CategorieVehicule } from "@/lib/types";
import { db, type Tx } from "@/lib/db";
import { dansLaZonePlausible, geocoderDansLaZone } from "@/lib/deplacement";

export const CATEGORIES_VEHICULE: CategorieVehicule[] = ["CITADINE", "BERLINE", "SUV", "MONOSPACE", "UTILITAIRE"];

export type NouveauClient = {
  prenom: string;
  nom: string;
  telephone: string;
  email?: string | null;
  adresse?: {
    libelle?: string | null;
    adresse: string;
    ville: string;
    codePostal?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  vehicule?: {
    categorie: CategorieVehicule;
    marque?: string | null;
    modele?: string | null;
    immatriculation?: string | null;
  } | null;
};

async function position(adresse: NonNullable<NouveauClient["adresse"]>) {
  // Sans coordonnées, le moteur « meilleur opérateur » ne peut pas calculer
  // les trajets : on géocode l'adresse.
  if (adresse.latitude != null && adresse.longitude != null) return { latitude: adresse.latitude, longitude: adresse.longitude };
  const trouvee = await geocoderDansLaZone(adresse.adresse, adresse.ville, adresse.codePostal);
  return { latitude: trouvee?.latitude ?? null, longitude: trouvee?.longitude ?? null };
}

export async function creerClient(donnees: NouveauClient, tx: Tx = db) {
  const coordonnees = donnees.adresse ? await position(donnees.adresse) : null;
  return tx.client.create({
    data: {
      prenom: donnees.prenom,
      nom: donnees.nom,
      telephone: donnees.telephone,
      email: donnees.email ?? null,
      adresses: donnees.adresse
        ? {
            create: {
              libelle: donnees.adresse.libelle ?? "Domicile",
              adresse: donnees.adresse.adresse,
              ville: donnees.adresse.ville,
              codePostal: donnees.adresse.codePostal ?? null,
              ...coordonnees,
            },
          }
        : undefined,
      vehicules: donnees.vehicule
        ? {
            create: {
              categorie: donnees.vehicule.categorie,
              marque: donnees.vehicule.marque ?? null,
              modele: donnees.vehicule.modele ?? null,
              immatriculation: donnees.vehicule.immatriculation ?? null,
            },
          }
        : undefined,
    },
    include: { adresses: true, vehicules: true },
  });
}

// Chiffres d'un numéro français, « +33 6 12… » et « 06 12… » confondus.
export function chiffresTelephone(telephone: string) {
  return telephone.replace(/\D/g, "").replace(/^33/, "0");
}

// Client dont le numéro correspond (format libre : espaces, +33…).
export async function trouverClientParTelephone(telephone: string, tx: Tx = db) {
  const chiffres = chiffresTelephone(telephone);
  if (chiffres.length < 9) return null;
  const fin = chiffres.slice(-9);
  const candidats = await tx.client.findMany({ where: { telephone: { contains: fin.slice(-4) } } });
  return candidats.find((c) => chiffresTelephone(c.telephone) === chiffres) ?? null;
}

// Réservation en ligne : un client déjà connu (même téléphone) est
// retrouvé plutôt que dupliqué ; l'adresse et le véhicule saisis lui sont
// ajoutés s'ils sont nouveaux.
export async function trouverOuCreerClient(
  donnees: NouveauClient & {
    adresse: NonNullable<NouveauClient["adresse"]>;
    vehicule: NonNullable<NouveauClient["vehicule"]>;
  },
  tx: Tx = db
) {
  const existant = await trouverClientParTelephone(donnees.telephone, tx);
  if (!existant) {
    const client = await creerClient(donnees, tx);
    return { client, adresseId: client.adresses[0].id, vehiculeId: client.vehicules[0].id };
  }

  const normaliser = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
  const adresses = await tx.adresse.findMany({ where: { clientId: existant.id } });
  let adresse = adresses.find(
    (a) => normaliser(a.adresse) === normaliser(donnees.adresse.adresse) && normaliser(a.ville) === normaliser(donnees.adresse.ville)
  );
   if (!adresse) {
     adresse = await tx.adresse.create({
       data: {
         clientId: existant.id,
         libelle: "Réservation en ligne",
         adresse: donnees.adresse.adresse,
         ville: donnees.adresse.ville,
         codePostal: donnees.adresse.codePostal ?? null,
         ...(await position(donnees.adresse)),
       },
     });
   }

  const vehicules = await tx.vehicule.findMany({ where: { clientId: existant.id } });
  let vehicule = vehicules.find(
    (v) => v.categorie === donnees.vehicule.categorie && normaliser(v.modele ?? "") === normaliser(donnees.vehicule.modele ?? "")
  );
  if (!vehicule) {
    vehicule = await tx.vehicule.create({
      data: {
        clientId: existant.id,
        categorie: donnees.vehicule.categorie,
        marque: donnees.vehicule.marque ?? null,
        modele: donnees.vehicule.modele ?? null,
        immatriculation: donnees.vehicule.immatriculation ?? null,
      },
    });
  }
  return { client: existant, adresseId: adresse.id, vehiculeId: vehicule.id };
}

/**
 * Ce qui empêche d'effacer une fiche client, ou null si rien ne s'y oppose.
 *
 * Un rendez-vous facturé ou encaissé est une pièce comptable : elle se
 * conserve dix ans, et effacer le client qui la porte la rendrait
 * inexploitable. Les rendez-vous sans trace comptable, eux, partent avec la
 * fiche — c'est ce que demande un droit à l'effacement.
 */
export async function obstacleSuppressionClient(clientId: string, tx: Tx = db): Promise<string | null> {
  const rdv = await tx.rendezVous.findMany({
    where: { clientId },
    select: { numeroFacture: true, acompteStatut: true, paiementConfirmeAt: true },
  });
  const comptables = rdv.filter((r) => r.numeroFacture || r.acompteStatut === "PAYE" || r.paiementConfirmeAt);
  if (comptables.length === 0) return null;
  return comptables.length === 1
    ? "Ce client a un rendez-vous facturé ou payé : la pièce comptable se conserve, la fiche ne peut pas être effacée."
    : `Ce client a ${comptables.length} rendez-vous facturés ou payés : ces pièces comptables se conservent, la fiche ne peut pas être effacée.`;
}

/**
 * Garantit qu'une adresse porte ses coordonnées, en la géocodant au besoin.
 *
 * Toutes les adresses ne naissent pas géocodées : un devis converti en
 * rendez-vous, une fiche saisie à la main, une adresse que la Base Adresse
 * Nationale ne reconnaissait pas ce jour-là. Sans coordonnées, le moteur
 * d'affectation refuse le dossier — et un rendez-vous qu'on ne peut pas
 * affecter bloque le créneau sans jamais être réalisé.
 *
 * Le géocodage est donc retenté au moment où l'on en a besoin, et le
 * résultat enregistré : on ne rappelle pas un service tiers deux fois pour
 * la même adresse.
 */
export async function assurerGeocodage(
  adresseId: string,
  tx: Tx = db
): Promise<{ latitude: number; longitude: number } | null> {
  const adresse = await tx.adresse.findUnique({ where: { id: adresseId } });
  if (!adresse) return null;
  // Une position déjà enregistrée n'est reprise que si elle est plausible :
  // les adresses géocodées avant le garde-fou peuvent pointer à 700 km, et
  // les garder figerait le dossier dans son erreur.
  if (adresse.latitude != null && adresse.longitude != null && dansLaZonePlausible(adresse.latitude, adresse.longitude)) {
    return { latitude: adresse.latitude, longitude: adresse.longitude };
  }

  const trouvee = await geocoderDansLaZone(adresse.adresse, adresse.ville, adresse.codePostal);
  if (!trouvee) return null;
  await tx.adresse.update({
    where: { id: adresseId },
    data: { latitude: trouvee.latitude, longitude: trouvee.longitude },
  });
  return { latitude: trouvee.latitude, longitude: trouvee.longitude };
}
