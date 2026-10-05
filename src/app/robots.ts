import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/business";

/**
 * Règles d'exploration.
 *
 * Tout ce qui est public est ouvert, y compris aux robots des moteurs génératifs —
 * `OAI-SearchBot` et consorts passent par la règle générale, et rien ne les bloque.
 * Les espaces authentifiés sont fermés : ils ne contiennent rien d'indexable et
 * exposeraient des références de rendez-vous dans les résultats.
 *
 * Un déploiement de démonstration se ferme entièrement. Il sert le même contenu que le
 * site réel : laissé ouvert, il lui dispute ses propres pages dans les résultats.
 * La variable est lue directement plutôt qu'importée de `server/demo/mode` — ce module
 * tire le jeu de données complet, ce qui n'a rien à faire dans une route `robots.txt`.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.DEMO_MODE === "1") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/pro", "/api/", "/connexion", "/demo", "/espace/", "/avis/", "/reservation/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
