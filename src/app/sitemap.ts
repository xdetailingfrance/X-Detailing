import type { MetadataRoute } from "next";
import { origineSite } from "@/lib/email";

/**
 * sitemap.xml — il répondait 404.
 *
 * Seules les pages publiques y figurent. Un plan de site qui annonce des
 * pages privées ou inexistantes dessert plus qu'il n'aide.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = origineSite();
  const maintenant = new Date();
  return [
    { url: `${site}/`, lastModified: maintenant, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/conditions-generales`, lastModified: maintenant, changeFrequency: "yearly", priority: 0.3 },
  ];
}
