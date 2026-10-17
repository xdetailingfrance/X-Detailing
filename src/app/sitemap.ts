import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/business";

/**
 * Plan du site — les pages qui méritent d'être trouvées. La candidature n'y figure
 * pas : elle se déclare elle-même hors index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/devenir-operateur`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
