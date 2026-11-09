/**
 * Facture fictive, pour éprouver l'envoi de bout en bout.
 *
 * Elle ne touche pas à la base : on n'envoie pas la facture d'un vrai client
 * à une adresse de test — ce serait divulguer son nom, son adresse et son
 * véhicule à un tiers. Les montants et la mise en page sont ceux d'une
 * vraie facture, PDF compris, pour que le test prouve quelque chose.
 */
import type { Facture } from "@/lib/facturation";

export function factureDemo(): Facture {
  const maintenant = new Date();
  const prestation = new Date(maintenant.getTime() - 3 * 3600000);
  const base = {
    id: "demo-facture",
    createdAt: maintenant,
    updatedAt: maintenant,
  };

  return {
    ...base,
    clientId: "demo-client",
    vehiculeId: "demo-vehicule",
    adresseId: "demo-adresse",
    packId: "demo-pack",
    categorieVehicule: "SUV",
    secteurId: null,
    operateurId: "demo-operateur",
    dateHeure: prestation,
    dureeMinutes: 180,
    prixTotal: 269,
    acompte: 26.9,
    fraisDeplacement: 10,
    distanceKm: 18.7,
    statut: "TERMINE",
    source: "TELEPHONE",
    notes: null,
    version: 1,
    suiviToken: "demonstration",
    routeDemarreeAt: null,
    positionLatitude: null,
    positionLongitude: null,
    positionAt: null,
    signatureControleDataUrl: null,
    signatureControleAt: null,
    photosAvant: [],
    lavageDemarreAt: null,
    photosApres: [],
    signatureFinDataUrl: null,
    signatureFinAt: null,
    modePaiement: "CARTE",
    lienPaiementEnvoyeAt: null,
    paiementConfirmeAt: maintenant,
    numeroFacture: "XD-DEMO-0001",
    historique: [],
    noteClient: null,
    noteClientAt: null,
    acompteStatut: "PAYE",
    stripeSessionId: null,
    client: {
      id: "demo-client",
      prenom: "Client",
      nom: "de démonstration",
      telephone: "06 00 00 00 00",
      email: null,
      createdAt: maintenant,
      updatedAt: maintenant,
    },
    vehicule: {
      id: "demo-vehicule",
      clientId: "demo-client",
      categorie: "SUV",
      marque: "Peugeot",
      modele: "3008",
      immatriculation: "AA-000-AA",
      createdAt: maintenant,
    },
    adresse: {
      id: "demo-adresse",
      clientId: "demo-client",
      libelle: "Démonstration",
      adresse: "Place de la Bourse",
      ville: "Bordeaux",
      codePostal: "33000",
      latitude: null,
      longitude: null,
      createdAt: maintenant,
    },
    pack: {
      id: "demo-pack",
      nom: "Concession Luxe",
      description: null,
      dureeMinMinutes: 180,
      dureeMaxMinutes: 180,
      actif: true,
      ordre: 0,
      createdAt: maintenant,
      updatedAt: maintenant,
    },
    operateur: {
      id: "demo-operateur",
      prenom: "Mathieu",
      nom: "Caumeil",
      telephone: "06 49 36 83 28",
      email: null,
      statut: "ACTIF",
      secteurId: null,
      adresseDomicile: null,
      latitudeDomicile: null,
      longitudeDomicile: null,
      heureDebut: "07:45",
      heureFin: "18:00",
      kangooImmatriculation: null,
      createdAt: maintenant,
      updatedAt: maintenant,
    },
    options: [
      {
        id: "demo-option-ligne",
        rendezVousId: "demo-facture",
        optionId: "demo-option",
        prixUnitaire: 50,
        quantite: 1,
        option: {
          id: "demo-option",
          nom: "Traitement du cuir",
          prix: 50,
          groupe: null,
          unite: null,
          quantiteMax: 1,
          actif: true,
          ordre: 0,
          createdAt: maintenant,
          updatedAt: maintenant,
        },
      },
    ],
  } as unknown as Facture;
}
