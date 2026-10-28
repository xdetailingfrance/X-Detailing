// Créneaux réellement disponibles pour la réservation en ligne. Les heures
// de départ sont celles du site X Detailing (8h30, 11h30, 15h ; le samedi
// 9h et 12h ; le dimanche un seul départ à 10h), en heure de Paris ;
// chacune n'est
// proposée que si, à cette heure, il reste au moins un opérateur libre
// pendant toute la durée du pack (marge de sécurité comprise), une fois
// retirés les RDV déjà affectés et ceux encore en attente d'opérateur.
//
// Le trajet n'est pas connu à ce stade (l'adresse est saisie après) : le
// moteur d'affectation (src/lib/affectation.ts) reste la référence quand
// le RDV est ensuite attribué.
import { db, type Tx } from "@/lib/db";
import { dateParis, decalerJour, jourSemaineParis } from "@/lib/heure";

// Heures de départ proposées aux clients (celles du site X Detailing).
export const HEURES_CRENEAUX = ["08:30", "11:30", "15:00"];
export const HEURES_CRENEAUX_SAMEDI = ["09:00", "12:00"];
// Un seul rendez-vous le dimanche, et un seul : c'est une ouverture
// exceptionnelle, pas une journée de travail ordinaire.
export const HEURES_CRENEAUX_DIMANCHE = ["10:00"];
const MARGE_MINUTES = 15; // même marge que le moteur d'affectation
// Un créneau libre se réserve jusqu'à la dernière minute : 30 minutes avant
// le départ. En minutes et non en heures — une demi-heure ne s'écrit pas
// « 0,5 heure » dans des conditions générales.
export const DELAI_MINIMUM_MINUTES = 30;
export const JOURS_RESERVABLES = 21;

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// « YYYY-MM-DD » + « HH:mm » en heure de Paris → instant.
export function dateLocale(jour: string, heure = "00:00") {
    return dateParis(jour, heure);
}

function chevauche(debut: number, fin: number, r: { dateHeure: Date; dureeMinutes: number }) {
  const d = r.dateHeure.getTime();
  const f = d + (r.dureeMinutes + MARGE_MINUTES) * 60000;
  return d < fin + MARGE_MINUTES * 60000 && f > debut;
}

export async function creneauxDisponibles(jour: string, dureeMinutes: number, tx: Tx = db): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return [];
  const debutJour = dateParis(jour);
  if (Number.isNaN(debutJour.getTime())) return [];
  const limite = Date.now() + DELAI_MINIMUM_MINUTES * 60000;
  const horizon = Date.now() + JOURS_RESERVABLES * 86400000;
  if (debutJour.getTime() > horizon) return [];

    const jourSemaine = jourSemaineParis(new Date(debutJour.getTime() + 12 * 3600000));
    const heures =
      jourSemaine === 0
        ? HEURES_CRENEAUX_DIMANCHE
        : jourSemaine === 6
          ? HEURES_CRENEAUX_SAMEDI
          : HEURES_CRENEAUX;

  // Requêtes successives : elles peuvent s'exécuter dans une transaction.
  const rdvDuJour = await tx.rendezVous.findMany({
    where: { statut: { not: "ANNULE" }, dateHeure: { gte: debutJour, lt: dateParis(decalerJour(jour, 1)) } },
    select: { dateHeure: true, dureeMinutes: true, operateurId: true },
  });
  const operateurs = await tx.operateur.findMany({ where: { statut: "ACTIF" }, select: { id: true, heureDebut: true, heureFin: true } });
  if (operateurs.length === 0) return [];

    const creneaux: string[] = [];
    for (const heure of heures) {
      const t = minutes(heure);
      const debut = dateParis(jour, heure).getTime();
      const fin = debut + dureeMinutes * 60000;
      if (debut < limite) continue;

      const libres = operateurs.filter(
        (o) =>
          minutes(o.heureDebut) <= t &&
          t + dureeMinutes <= minutes(o.heureFin) &&
          !rdvDuJour.some((r) => r.operateurId === o.id && chevauche(debut, fin, r))
      ).length;
      const enAttente = rdvDuJour.filter((r) => !r.operateurId && chevauche(debut, fin, r)).length;
      if (libres - enAttente > 0) creneaux.push(heure);
    }
    return creneaux;
}

