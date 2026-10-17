import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/business";

/** Tout est public, y compris pour les robots des moteurs génératifs — sauf la gestion. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/gestion"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
