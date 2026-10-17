/**
 * Les créneaux proposés à la réservation — source unique, sans base de données.
 *
 * Trois départs par jour. Un créneau se propose s'il tombe un jour ouvert et s'il
 * laisse assez de délai pour organiser la tournée. La base de données ne sert qu'à
 * savoir lesquels sont déjà pris.
 *
 * Toutes les dates sont raisonnées à l'heure de Paris : le serveur, lui, tourne en
 * UTC, et un créneau de 8 h 30 ne doit pas glisser à 6 h 30 une fois en ligne.
 */

export const CRENEAUX = ["08:30", "11:30", "15:00"] as const;
export type Creneau = (typeof CRENEAUX)[number];

/**
 * Jours ouverts à la réservation en ligne, 0 = dimanche … 6 = samedi.
 * Du lundi au samedi par défaut — à ajuster si les horaires sont différents.
 */
export const JOURS_OUVERTS: readonly number[] = [1, 2, 3, 4, 5, 6];

/** Jusqu'à combien de jours à l'avance on peut réserver. */
export const HORIZON_JOURS = 14;

/** Délai minimal entre la réservation et le créneau, en heures. */
export const DELAI_MINIMUM_HEURES = 24;

const TZ = "Europe/Paris";

/** Décalage de Paris par rapport à UTC, en minutes, à un instant donné. */
function decalageParis(instant: Date): number {
  const nom = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(nom ?? "");
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** L'instant correspondant à `jour` (AAAA-MM-JJ) à `heure` (HH:MM), heure de Paris. */
export function instantParis(jour: string, heure: string): Date {
  const [a, m, j] = jour.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const estimation = Date.UTC(a, m - 1, j, h, mi);
  return new Date(estimation - decalageParis(new Date(estimation)) * 60_000);
}

/** La date du jour à Paris, en AAAA-MM-JJ. */
export function jourParis(instant: Date): string {
  // `en-CA` écrit les dates en AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function ajouterJours(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

function jourDeSemaine(jour: string): number {
  const [a, m, j] = jour.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j)).getUTCDay();
}

/** « 8 h 30 », « 15 h ». */
export function libelleHeure(heure: Creneau): string {
  const [h, m] = heure.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

/** « samedi 24 octobre », ou « sam. 24 oct. » en court. */
export function libelleJour(jour: string, format: "long" | "court" | "complet" = "long"): string {
  const options: Intl.DateTimeFormatOptions =
    format === "court"
      ? { weekday: "short", day: "numeric", month: "short" }
      : format === "complet"
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { weekday: "long", day: "numeric", month: "long" };
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...options }).format(
    instantParis(jour, "12:00"),
  );
}

/** « samedi 24 octobre 2026 à 11 h 30 ». */
export function libelleCreneau(jour: string, heure: Creneau): string {
  return `${libelleJour(jour, "complet")} à ${libelleHeure(heure)}`;
}

export type JourPropose = {
  jour: string;
  libelle: string;
  court: string;
  creneaux: Creneau[];
};

/**
 * Les jours et heures que l'on peut encore réserver à cet instant, dans l'ordre.
 * Un jour sans créneau restant n'apparaît pas.
 */
export function joursProposes(maintenant = new Date()): JourPropose[] {
  const limite = maintenant.getTime() + DELAI_MINIMUM_HEURES * 3_600_000;
  const premier = jourParis(maintenant);
  const jours: JourPropose[] = [];

  for (let i = 0; i <= HORIZON_JOURS; i += 1) {
    const jour = ajouterJours(premier, i);
    if (!JOURS_OUVERTS.includes(jourDeSemaine(jour))) continue;

    const creneaux = CRENEAUX.filter((heure) => instantParis(jour, heure).getTime() >= limite);
    if (creneaux.length === 0) continue;

    jours.push({
      jour,
      libelle: libelleJour(jour, "long"),
      court: libelleJour(jour, "court"),
      creneaux,
    });
  }

  return jours;
}

/** Vrai si ce créneau fait partie de ceux que l'on propose à cet instant. */
export function creneauPropose(jour: string, heure: Creneau, maintenant = new Date()): boolean {
  return joursProposes(maintenant).some((j) => j.jour === jour && j.creneaux.includes(heure));
}
