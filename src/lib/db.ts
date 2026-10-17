import { Pool } from "pg";

/**
 * Les réservations — la seule chose que le site garde en base.
 *
 * Un créneau pris ne doit plus être proposé à personne : c'est un état partagé entre
 * tous les visiteurs, un e-mail ne peut pas le porter. La base ne fait que ça. Elle
 * se crée elle-même au premier appel : une table, un index unique, pas d'outil de
 * migration.
 *
 * L'exclusivité est garantie par l'index unique sur (jour, créneau), pas par une
 * lecture suivie d'une écriture : deux visiteurs qui valident la même seconde ne
 * peuvent pas obtenir le même créneau. Une réservation annulée (`annule_le`)
 * libère le créneau.
 *
 * Sans `DATABASE_URL` en développement, les réservations vivent en mémoire du
 * serveur de dev : on peut dérouler le formulaire sans Postgres. En production,
 * l'absence de base est une erreur, jamais une simulation.
 */

export type NouvelleReservation = {
  jour: string;
  creneau: string;
  formule: string;
  vehicule: string;
  options: string[];
  totalEuros: number;
  adresse: string;
  codePostal: string;
  ville: string;
  precisions: string | null;
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  message: string | null;
};

export type Reservation = NouvelleReservation & { id: string; creeLe: string };

export type Enregistrement = { ok: true; id: string } | { ok: false; raison: "creneau-pris" };

/** Clé d'un créneau, telle qu'on la compare partout. */
export const cleCreneau = (jour: string, creneau: string) => `${jour}|${creneau}`;

interface Depot {
  /** Les créneaux déjà pris entre deux jours inclus, sous forme de clés. */
  creneauxPris(premierJour: string, dernierJour: string): Promise<Set<string>>;
  enregistrer(reservation: NouvelleReservation): Promise<Enregistrement>;
  /** Efface une réservation dont l'e-mail n'est pas parti : le créneau redevient libre. */
  supprimer(id: string): Promise<void>;
  /** Les réservations actives à partir d'un jour, dans l'ordre du calendrier. */
  reservationsAVenir(depuisJour: string): Promise<Reservation[]>;
  /** Libère le créneau en gardant la trace de la réservation. */
  annuler(id: string): Promise<void>;
}

/* ── Postgres ──────────────────────────────────────────────────────────────── */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS reservation (
    id          bigserial PRIMARY KEY,
    jour        date        NOT NULL,
    creneau     text        NOT NULL,
    formule     text        NOT NULL,
    vehicule    text        NOT NULL,
    options     text[]      NOT NULL DEFAULT '{}',
    total_euros integer     NOT NULL,
    adresse     text        NOT NULL,
    code_postal text        NOT NULL,
    ville       text        NOT NULL,
    precisions  text,
    prenom      text        NOT NULL,
    nom         text        NOT NULL,
    telephone   text        NOT NULL,
    email       text        NOT NULL,
    message     text,
    cree_le     timestamptz NOT NULL DEFAULT now(),
    annule_le   timestamptz
  );
  CREATE UNIQUE INDEX IF NOT EXISTS reservation_creneau_unique
    ON reservation (jour, creneau) WHERE annule_le IS NULL;
`;

const COLONNES = `
  id, to_char(jour, 'YYYY-MM-DD') AS jour, creneau, formule, vehicule, options,
  total_euros, adresse, code_postal, ville, precisions, prenom, nom, telephone, email,
  message, cree_le
`;

type Ligne = {
  id: string;
  jour: string;
  creneau: string;
  formule: string;
  vehicule: string;
  options: string[];
  total_euros: number;
  adresse: string;
  code_postal: string;
  ville: string;
  precisions: string | null;
  prenom: string;
  nom: string;
  telephone: string;
  email: string;
  message: string | null;
  cree_le: Date;
};

function versReservation(l: Ligne): Reservation {
  return {
    id: String(l.id),
    jour: l.jour,
    creneau: l.creneau,
    formule: l.formule,
    vehicule: l.vehicule,
    options: l.options,
    totalEuros: l.total_euros,
    adresse: l.adresse,
    codePostal: l.code_postal,
    ville: l.ville,
    precisions: l.precisions,
    prenom: l.prenom,
    nom: l.nom,
    telephone: l.telephone,
    email: l.email,
    message: l.message,
    creeLe: new Date(l.cree_le).toISOString(),
  };
}

declare global {
  // Conservés entre deux rechargements à chaud du serveur de développement.
  var __xdPool: Pool | undefined;
  var __xdSchema: Promise<void> | undefined;
  var __xdMemoire: Map<string, Reservation> | undefined;
}

function pool(url: string): Pool {
  if (!globalThis.__xdPool) {
    const chiffre = /sslmode=require|neon\.tech/.test(url);
    globalThis.__xdPool = new Pool({
      connectionString: url,
      max: 3,
      ssl: chiffre ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalThis.__xdPool;
}

function schemaPret(p: Pool): Promise<void> {
  if (!globalThis.__xdSchema) {
    globalThis.__xdSchema = p.query(SCHEMA).then(
      () => undefined,
      (error) => {
        // Un échec ne doit pas condamner le processus : on réessaiera à l'appel suivant.
        globalThis.__xdSchema = undefined;
        throw error;
      },
    );
  }
  return globalThis.__xdSchema;
}

function postgres(url: string): Depot {
  const p = pool(url);
  return {
    async creneauxPris(premierJour, dernierJour) {
      await schemaPret(p);
      const { rows } = await p.query<{ jour: string; creneau: string }>(
        `SELECT to_char(jour, 'YYYY-MM-DD') AS jour, creneau
           FROM reservation
          WHERE annule_le IS NULL AND jour BETWEEN $1::date AND $2::date`,
        [premierJour, dernierJour],
      );
      return new Set(rows.map((r) => cleCreneau(r.jour, r.creneau)));
    },

    async enregistrer(r) {
      await schemaPret(p);
      const { rows } = await p.query<{ id: string }>(
        `INSERT INTO reservation
           (jour, creneau, formule, vehicule, options, total_euros, adresse, code_postal,
            ville, precisions, prenom, nom, telephone, email, message)
         VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (jour, creneau) WHERE annule_le IS NULL DO NOTHING
         RETURNING id`,
        [
          r.jour, r.creneau, r.formule, r.vehicule, r.options, r.totalEuros, r.adresse,
          r.codePostal, r.ville, r.precisions, r.prenom, r.nom, r.telephone, r.email, r.message,
        ],
      );
      return rows[0] ? { ok: true, id: String(rows[0].id) } : { ok: false, raison: "creneau-pris" };
    },

    async supprimer(id) {
      await p.query(`DELETE FROM reservation WHERE id = $1`, [id]);
    },

    async reservationsAVenir(depuisJour) {
      await schemaPret(p);
      const { rows } = await p.query<Ligne>(
        `SELECT ${COLONNES}
           FROM reservation
          WHERE annule_le IS NULL AND jour >= $1::date
          ORDER BY jour, creneau`,
        [depuisJour],
      );
      return rows.map(versReservation);
    },

    async annuler(id) {
      await p.query(`UPDATE reservation SET annule_le = now() WHERE id = $1 AND annule_le IS NULL`, [id]);
    },
  };
}

/* ── Mémoire — développement seulement ─────────────────────────────────────── */

function memoire(): Depot {
  const store = (globalThis.__xdMemoire ??= new Map());
  return {
    async creneauxPris(premierJour, dernierJour) {
      return new Set(
        [...store.values()]
          .filter((r) => r.jour >= premierJour && r.jour <= dernierJour)
          .map((r) => cleCreneau(r.jour, r.creneau)),
      );
    },
    async enregistrer(r) {
      const cle = cleCreneau(r.jour, r.creneau);
      if (store.has(cle)) return { ok: false, raison: "creneau-pris" };
      const id = String(Date.now());
      store.set(cle, { ...r, id, creeLe: new Date().toISOString() });
      return { ok: true, id };
    },
    async supprimer(id) {
      for (const [cle, r] of store) if (r.id === id) store.delete(cle);
    },
    async reservationsAVenir(depuisJour) {
      return [...store.values()]
        .filter((r) => r.jour >= depuisJour)
        .sort((a, b) => cleCreneau(a.jour, a.creneau).localeCompare(cleCreneau(b.jour, b.creneau)));
    },
    async annuler(id) {
      for (const [cle, r] of store) if (r.id === id) store.delete(cle);
    },
  };
}

/* ── Le dépôt en service ───────────────────────────────────────────────────── */

export function depot(): Depot {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return postgres(url);
  if (process.env.NODE_ENV !== "production") {
    console.info("[reservations] DATABASE_URL absente — réservations gardées en mémoire.");
    return memoire();
  }
  throw new Error("DATABASE_URL absente : les réservations ne peuvent pas être enregistrées.");
}
