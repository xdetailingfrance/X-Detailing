import type { MetadataRoute } from "next";
import { origineSite } from "@/lib/email";

/**
 * robots.txt — il répondait 404.
 *
 * Le back-office, l'espace opérateur, les pages de suivi et les devis
 * portent des données de clients : ils n'ont rien à faire dans un index.
 * Les jetons de suivi ne sont pas devinables, mais une URL partagée par
 * mégarde finirait par être explorée.
 *
 * Les robots des assistants (ChatGPT, Claude, Perplexity) ne sont pas
 * bloqués : être cité par eux est une source de visites, et rien de
 * confidentiel n'est exposé sur les pages publiques.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/back-office/", "/operateur/", "/suivi/", "/devis/", "/login", "/demo", "/api/"],
      },
    ],
    sitemap: `${origineSite()}/sitemap.xml`,
    host: origineSite(),
  };
}
