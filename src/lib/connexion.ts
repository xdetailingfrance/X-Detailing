// Paramètres de connexion PostgreSQL partagés par l'application, les
// scripts et Prisma Migrate. DATABASE_SCHEMA (facultatif) range toutes les
// tables dans un schéma dédié : la base peut alors être partagée avec une
// autre application sans toucher à ses tables.
import { PrismaPg } from "@prisma/adapter-pg";

function schemaBdd(): string | undefined {
  const schema = process.env.DATABASE_SCHEMA?.trim();
  if (!schema) return undefined;
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error(`DATABASE_SCHEMA invalide : « ${schema} »`);
  return schema;
}

export function adaptateurPg(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL manquant : voir .env.example");
  const schema = schemaBdd();
  return new PrismaPg({ connectionString }, schema ? { schema } : undefined);
}

// Nom de table qualifié pour les requêtes SQL brutes.
export function table(nom: string) {
  const schema = schemaBdd();
  return schema ? `"${schema}"."${nom}"` : `"${nom}"`;
}

// URL pour Prisma Migrate : connexion directe si disponible (Neon), avec le
// schéma dédié.
export function urlMigrations() {
  const brute = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const schema = schemaBdd();
  if (!brute || !schema) return brute;
  const url = new URL(brute);
  url.searchParams.set("schema", schema);
  return url.toString();
}

