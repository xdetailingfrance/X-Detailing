// Heure de Paris, quel que soit le fuseau du serveur (Vercel tourne en
// UTC) : créneaux, journées, plannings et dates affichées dans les SMS ou
// les écrans sont tous exprimés en Europe/Paris.
export const FUSEAU = "Europe/Paris";

const lecteur = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSEAU,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const JOURS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Composantes de la date en heure de Paris.
export function composantesParis(date: Date) {
  const p = Object.fromEntries(lecteur.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    annee: Number(p.year),
    mois: Number(p.month),
    jour: Number(p.day),
    heure: Number(p.hour),
    minute: Number(p.minute),
    seconde: Number(p.second),
    jourSemaine: JOURS.indexOf(p.weekday), // 0 = dimanche
  };
}

// Décalage de Paris par rapport à UTC à cet instant, en minutes (60 ou 120).
function decalageMinutes(date: Date) {
  const c = composantesParis(date);
  const commeUtc = Date.UTC(c.annee, c.mois - 1, c.jour, c.heure, c.minute, c.seconde);
  return Math.round((commeUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

// « 2026-10-26 » + « 08:30 » à Paris → instant.
export function dateParis(jour: string, heure = "00:00"): Date {
  const [a, m, j] = jour.split("-").map(Number);
  const [h, min] = heure.split(":").map(Number);
  const supposition = Date.UTC(a, m - 1, j, h, min);
  let instant = supposition - decalageMinutes(new Date(supposition)) * 60000;
  // Au changement d'heure, le décalage à l'instant trouvé peut différer.
  const correction = decalageMinutes(new Date(instant));
  instant = supposition - correction * 60000;
  return new Date(instant);
}

const deux = (n: number) => String(n).padStart(2, "0");

// Instant → « 2026-10-26 » (jour à Paris).
export function jourParis(date: Date): string {
  const c = composantesParis(date);
  return `${c.annee}-${deux(c.mois)}-${deux(c.jour)}`;
}

// Instant → « 08:30 » (heure à Paris).
export function heureParis(date: Date): string {
  const c = composantesParis(date);
  return `${deux(c.heure)}:${deux(c.minute)}`;
}

export function jourSemaineParis(date: Date): number {
  return composantesParis(date).jourSemaine;
}

// Ajoute n jours à un jour « YYYY-MM-DD ».
export function decalerJour(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())}`;
}

// Minuit à Paris du jour de cet instant (et du lendemain).
export function debutJourParis(date: Date): Date {
  return dateParis(jourParis(date));
}
export function finJourParis(date: Date): Date {
  return dateParis(decalerJour(jourParis(date), 1));
}

// Lundi 0 h (Paris) de la semaine de cet instant.
export function debutSemaineParis(date: Date): Date {
  const jour = jourParis(date);
  const decalage = (jourSemaineParis(date) + 6) % 7;
  return dateParis(decalerJour(jour, -decalage));
}

// 1er du mois 0 h (Paris).
export function debutMoisParis(date: Date): Date {
  const c = composantesParis(date);
  return dateParis(`${c.annee}-${deux(c.mois)}-01`);
}

// « YYYY-MM » du mois à Paris.
export function moisParis(date: Date = new Date()): string {
  const c = composantesParis(date);
  return `${c.annee}-${deux(c.mois)}`;
}

// Mise en forme française à l'heure de Paris.
export function formatParis(date: Date, options: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString("fr-FR", { ...options, timeZone: FUSEAU });
}

// « lundi 26 octobre à 08:30 »
export function libelleDateHeure(date: Date): string {
  return formatParis(date, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"});
}

// Date saisie dans un formulaire : « YYYY-MM-DDTHH:mm » sans fuseau est lue
// en heure de Paris ; une date ISO complète (avec Z ou décalage) telle quelle.
export function lireDateSaisie(valeur: unknown): Date {
  if (typeof valeur !== "string") return new Date(NaN);
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(valeur.trim());
  return m ? dateParis(m[1], m[2]) : new Date(valeur);
}

// Durée d'une prestation telle qu'on la dit : « 2h30 », « 3h », « 45 min ».
// Un client ne compte pas en minutes au-delà d'une heure.
export function dureeLisible(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// Fourchette annoncée. Deux bornes égales (le cas courant depuis que les
// durées sont fermes) se disent d'une seule voix.
export function plageDureeLisible(minMinutes: number, maxMinutes: number): string {
  return minMinutes === maxMinutes
    ? dureeLisible(minMinutes)
    : `${dureeLisible(minMinutes)} à ${dureeLisible(maxMinutes)}`;
}
