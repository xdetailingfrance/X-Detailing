import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Les migrations passent par la connexion directe quand l'hébergeur en expose une.
    // Derrière un pooler (pgbouncer chez Neon), `migrate deploy` échoue : il a besoin de
    // verrous de session que le pooler ne relaie pas. L'application, elle, garde le pool.
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
