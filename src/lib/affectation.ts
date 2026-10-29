import { db, versRdv } from "@/lib/db";
import { dateParis, debutJourParis, finJourParis, jourParis } from "@/lib/heure";
import { haversineKm, estimerTrajetMinutes, geocoderAdresse } from "@/lib/geo";

// Pondération du score — section 4 du cahier des charges (paramétrable).
const POIDS = {
  proximite: 0.4,
  disponibilite: 0.25,
  charge: 0.2,
  equilibreCa: 0.1,
  qualite: 0.05,
};

const MARGE_SECURITE_MINUTES = 15; // configurable par X Detailing (section 6)
const TRAJET_MAX_MINUTES = 60; // au-delà, proximité considérée comme nulle
const DISPONIBILITE_CAP_MINUTES = 90; // marge au-delà de laquelle le score dispo plafonne
const NB_CANDIDATS_RETOURNES = 3;

export type CandidatAffectation = {
  operateurId: string;
  nomComplet: string;
  secteurNom: string | null;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  nbPrestationsJour: number;
  caJour: number;
  margeAvantMinutes: number;
  margeApresMinutes: number | null;
};

export type CriteresAffectation = {
  latitude: number;
  longitude: number;
  dateHeure: Date;
  dureeMinutes: number;
  excludeRendezVousId?: string;
};

// « HH:mm » (heure de Paris) le jour de la date de référence.
function heureVersDate(jourReference: Date, heureHHmm: string) {
  return dateParis(jourParis(jourReference), heureHHmm);
}

/**
 * Calcule et classe les opérateurs éligibles pour un rendez-vous donné.
 * Ne retourne que les candidats dont la tournée reste réellement faisable
 * (trajet + marge de sécurité respectés) — section 6 & 39 du cahier des charges.
 */
export async function evaluerCandidats(
  criteres: CriteresAffectation
): Promise<CandidatAffectation[]> {
  const { latitude, longitude, dateHeure, dureeMinutes, excludeRendezVousId } =
    criteres;
  const finPrestation = new Date(dateHeure.getTime() + dureeMinutes * 60000);

   const lignes = await db.operateur.findMany({
     where: { statut: "ACTIF" },
     include: {
       secteur: true,
       rendezVous: {
         where: {
           statut: { not: "ANNULE" },
           dateHeure: { gte: debutJourParis(dateHeure), lt: finJourParis(dateHeure) },
           id: excludeRendezVousId ? { not: excludeRendezVousId } : undefined,
         },
         orderBy: { dateHeure: "asc" },
         include: { adresse: true },
       },
     },
   });
   const operateurs = lignes.map((o) => ({ ...o, rendezVous: o.rendezVous.map(versRdv) }));

   type Brut = CandidatAffectation & {
     proximiteBrut: number;
     disponibiliteBrut: number;
   };

   const candidatsFaisables: Brut[] = [];

   for (const operateur of operateurs) {
     if (operateur.latitudeDomicile == null || operateur.longitudeDomicile == null) {
       continue;
     }

      const rdvJour = operateur.rendezVous;
      const precedent = [...rdvJour]
        .filter((r) => new Date(r.dateHeure) <= dateHeure)
        .sort((a, b) => b.dateHeure.getTime() - a.dateHeure.getTime())[0];
      const suivant = [...rdvJour]
        .filter((r) => new Date(r.dateHeure) >= finPrestation)
        .sort((a, b) => a.dateHeure.getTime() - b.dateHeure.getTime())[0];

      // Point de départ avant ce rendez-vous : le précédent client, ou le domicile.
      const departLat = precedent?.adresse.latitude ?? operateur.latitudeDomicile;
      const departLng = precedent?.adresse.longitude ?? operateur.longitudeDomicile;
      const departDisponibleA = precedent
        ? new Date(precedent.dateHeure.getTime() + precedent.dureeMinutes * 60000)
        : heureVersDate(dateHeure, operateur.heureDebut);

      if (departLat == null || departLng == null) continue;

      const distanceKm = haversineKm(departLat, departLng, latitude, longitude);
      const trajetMinutes = estimerTrajetMinutes(distanceKm);

      const heureArriveeAuPlusTot = new Date(
        departDisponibleA.getTime() + trajetMinutes * 60000
      );
      const margeAvantMinutes =
        (dateHeure.getTime() - heureArriveeAuPlusTot.getTime()) / 60000;

      if (margeAvantMinutes < MARGE_SECURITE_MINUTES) {
        continue; // trajet + marge de sécurité non respectés
      }

    let margeApresMinutes: number | null = null;
    if (suivant) {
      const trajetVersSuivant = estimerTrajetMinutes(
        haversineKm(latitude, longitude, suivant.adresse.latitude ?? latitude, suivant.adresse.longitude ?? longitude)
      );
      const arriveeSuivantAuPlusTot = new Date(
        finPrestation.getTime() + trajetVersSuivant * 60000
      );
      margeApresMinutes =
        (suivant.dateHeure.getTime() - arriveeSuivantAuPlusTot.getTime()) / 60000;

        if (margeApresMinutes < MARGE_SECURITE_MINUTES) {
          continue; // rendrait la tournée suivante infaisable
        }
      } else {
        const finJourneeOperateur = heureVersDate(dateHeure, operateur.heureFin);
        if (finPrestation > finJourneeOperateur) {
          continue; // dépasse les horaires de l'opérateur
        }
      }

        const nbPrestationsJour = rdvJour.length;
        const caJour = rdvJour.reduce((total, r) => total + Number(r.prixTotal), 0);

        candidatsFaisables.push({
          operateurId: operateur.id,
          nomComplet: `${operateur.prenom} ${operateur.nom}`,
          secteurNom: operateur.secteur?.nom ?? null,
          score: 0, // calculé après normalisation
          distanceKm: Math.round(distanceKm * 10) / 10,
          etaMinutes: Math.round(trajetMinutes),
          nbPrestationsJour,
          caJour,
          margeAvantMinutes: Math.round(margeAvantMinutes),
          margeApresMinutes:
            margeApresMinutes != null ? Math.round(margeApresMinutes) : null,
          proximiteBrut: trajetMinutes,
          disponibiliteBrut: Math.min(
            margeAvantMinutes,
            margeApresMinutes ?? margeAvantMinutes
          ),
        });
    }

    if (candidatsFaisables.length === 0) return [];

    const maxNbPrestations = Math.max(
      1,
      ...candidatsFaisables.map((c) => c.nbPrestationsJour)
    );
    const maxCaJour = Math.max(1, ...candidatsFaisables.map((c) => c.caJour));

    const classes = candidatsFaisables
      .map((c) => {
        const proximiteScore = Math.max(0, 1 - c.proximiteBrut / TRAJET_MAX_MINUTES);
        const disponibiliteScore = Math.min(
          1,
          Math.max(0, c.disponibiliteBrut / DISPONIBILITE_CAP_MINUTES)
        );
        const chargeScore = 1 - c.nbPrestationsJour / maxNbPrestations;
        const equilibreCaScore = 1 - c.caJour / maxCaJour;
        const qualiteScore = 1; // TODO phase 6 : brancher le score qualité/avis réel (section 25)

         const score =
           100 *
           (POIDS.proximite * proximiteScore +
             POIDS.disponibilite * disponibiliteScore +
             POIDS.charge * chargeScore +
             POIDS.equilibreCa * equilibreCaScore +
             POIDS.qualite * qualiteScore);

          const candidat: CandidatAffectation = {
            operateurId: c.operateurId,
            nomComplet: c.nomComplet,
            secteurNom: c.secteurNom,
            score: Math.round(score),
            distanceKm: c.distanceKm,
            etaMinutes: c.etaMinutes,
            nbPrestationsJour: c.nbPrestationsJour,
            caJour: c.caJour,
            margeAvantMinutes: c.margeAvantMinutes,
            margeApresMinutes: c.margeApresMinutes,
          };
          return candidat;
        })
        .sort((a, b) => b.score - a.score);

    return classes.slice(0, NB_CANDIDATS_RETOURNES);
}

/**
 * Géocode le domicile des opérateurs actifs qui n'en ont pas encore.
 *
 * Un opérateur sans coordonnées est écarté en silence par evaluerCandidats :
 * il n'apparaît jamais, et l'écran conclut à des « tournées incompatibles »
 * alors que la fiche était simplement incomplète. On répare donc avant
 * d'évaluer, et on enregistre pour ne pas recommencer.
 *
 * Retourne le nombre d'opérateurs actifs exploitables une fois la réparation
 * faite, pour que l'appelant puisse dire la vraie raison d'une liste vide.
 */
export async function assurerGeocodageOperateurs(): Promise<{ exploitables: number; actifs: number }> {
  const actifs = await db.operateur.findMany({ where: { statut: "ACTIF" } });
  for (const o of actifs) {
    if (o.latitudeDomicile != null && o.longitudeDomicile != null) continue;
    if (!o.adresseDomicile) continue;
    const point = await geocoderAdresse(o.adresseDomicile, "", null);
    if (!point) continue;
    await db.operateur.update({
      where: { id: o.id },
      data: { latitudeDomicile: point.latitude, longitudeDomicile: point.longitude },
    });
    o.latitudeDomicile = point.latitude;
    o.longitudeDomicile = point.longitude;
  }
  return {
    exploitables: actifs.filter((o) => o.latitudeDomicile != null && o.longitudeDomicile != null).length,
    actifs: actifs.length,
  };
}

/**
 * Pourquoi aucun opérateur n'a pu être retenu.
 *
 * « Tournées incompatibles » n'aide personne : la cause la plus fréquente
 * est qu'aucun opérateur ne peut matériellement ARRIVER à l'heure depuis
 * son point de départ, parce que sa journée commence à l'heure même du
 * rendez-vous. On le dit, avec les minutes manquantes.
 */
export async function diagnostiquerAbsenceDeCandidat(criteres: CriteresAffectation): Promise<string> {
  const { latitude, longitude, dateHeure } = criteres;
  const operateurs = await db.operateur.findMany({ where: { statut: "ACTIF" } });
  let retardMin = Infinity;
  for (const o of operateurs) {
    if (o.latitudeDomicile == null || o.longitudeDomicile == null) continue;
    const trajet = estimerTrajetMinutes(haversineKm(o.latitudeDomicile, o.longitudeDomicile, latitude, longitude));
    const arrivee = heureVersDate(dateHeure, o.heureDebut).getTime() + trajet * 60000;
    retardMin = Math.min(retardMin, Math.round((arrivee - dateHeure.getTime()) / 60000));
  }
  if (retardMin > 0 && Number.isFinite(retardMin)) {
    return `Aucun opérateur ne peut arriver à l'heure : en partant de chez lui au début de sa journée, le plus proche arriverait ${retardMin} min trop tard. Avancez son heure de début, ou proposez un créneau plus tardif.`;
  }
  return "Aucun opérateur ne peut réaliser ce rendez-vous : sa tournée du jour ne laisse pas la place, trajets et marges compris.";
}
