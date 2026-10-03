import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/business";

/**
 * Règles d'exploration.
 *
 * Tout ce qui est public est ouvert, y compris aux robots des moteurs génératifs —
 * `OAI-SearchBot` et consorts passent par la règle générale, et rien ne les bloque.
 * Les espaces authentifiés sont fermés : ils ne contiennent rien d'indexable et
 * exposeraient des références de rendez-vous dans les résultats.
 */
export default function robots(): MetadataRoute.Robots {
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
