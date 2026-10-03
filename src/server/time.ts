/**
 * Horaires locaux sans dépendance.
 *
 * Les horaires opérateurs sont stockés en minutes depuis minuit (heure locale). Toutes
 * les conversions passent par Intl : l'heure d'été est gérée par le moteur ICU, pas par
 * un décalage codé en dur.
 */

export const TIMEZONE = "Europe/Paris";

const PARTS_FORMATTER = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = PARTS_FORMATTER.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    PARTS_FORMATTER.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  /** Minutes depuis minuit, heure locale. */
  minutes: number;
};

export function zonedParts(date: Date, tz: string = TIMEZONE): ZonedParts {
  const parts = Object.fromEntries(
    formatter(tz).formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute,
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

/** Décalage du fuseau à cet instant, en millisecondes. */
function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Minuit local du jour contenant `date`. Correct lors des changements d'heure. */
export function startOfLocalDay(date: Date, tz: string = TIMEZONE): Date {
  const p = zonedParts(date, tz);
  const naive = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  // Deux passes : le décalage à minuit peut différer de celui de `date`.
  let result = new Date(naive - offsetMs(date, tz));
  result = new Date(naive - offsetMs(result, tz));
  return result;
}

export function endOfLocalDay(date: Date, tz: string = TIMEZONE): Date {
  return new Date(startOfLocalDay(date, tz).getTime() + 24 * 3600_000);
}

/** Lundi 00h00 de la semaine contenant `date`. */
export function startOfLocalWeek(date: Date, tz: string = TIMEZONE): Date {
  const day = startOfLocalDay(date, tz);
  const weekday = zonedParts(day, tz).weekday;
  const backDays = (weekday + 6) % 7; // lundi = début de semaine
  return startOfLocalDay(new Date(day.getTime() - backDays * 24 * 3600_000), tz);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}

/** Minutes depuis minuit → « 08:30 ». */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatLocalTime(date: Date, tz: string = TIMEZONE): string {
  const p = zonedParts(date, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Premier jour du mois local, minuit. */
export function startOfLocalMonth(date: Date, tz: string = TIMEZONE): Date {
  const p = zonedParts(date, tz);
  return startOfLocalDay(new Date(Date.UTC(p.year, p.month - 1, 1, 12, 0, 0)), tz);
}

export function addMonths(date: Date, months: number, tz: string = TIMEZONE): Date {
  const p = zonedParts(date, tz);
  return startOfLocalDay(new Date(Date.UTC(p.year, p.month - 1 + months, 1, 12, 0, 0)), tz);
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatLocalDate(date: Date): string {
  return DATE_FORMATTER.format(date);
}

export function formatLocalDateTime(date: Date): string {
  return `${formatLocalDate(date)} ${formatLocalTime(date)}`;
}

/** `YYYY-MM-DD` en heure locale — format des champs `<input type="date">`. */
export function toLocalDateInput(date: Date, tz: string = TIMEZONE): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Inverse de `toLocalDateInput` + heure : construit l'instant UTC correspondant. */
export function fromLocalDateTimeInput(dateInput: string, timeInput: string, tz: string = TIMEZONE): Date {
  const [year, month, day] = dateInput.split("-").map(Number);
  const [hour, minute] = timeInput.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Deux passes pour rester correct au passage à l'heure d'été.
  let guess = new Date(naive);
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(guess, tz);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    guess = new Date(guess.getTime() + (naive - shown));
  }
  return guess;
}

/**
 * Durée d'intervention, telle qu'on l'annonce au client.
 *
 * « 2 h 40 » se lit d'un coup d'œil quand il s'agit de bloquer un après-midi ;
 * « 160 min » demande une division mentale. Pur calcul, donc utilisable des deux
 * côtés de la frontière client / serveur.
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
