import type { MetadataRoute } from "next";
import { prisma } from "@/server/db";
import { siteUrl } from "@/lib/business";

/**
 * Plan du site.
 *
 * Seules les pages qui existent réellement et qui méritent d'être trouvées. On
 * n'inscrit pas d'URL par ville tant qu'il n'y a pas, derrière chacune, un contenu
 * qui lui est propre : une page locale sans substance dilue les autres.
 */
/**
 * Régénéré toutes les heures.
 *
 * Sans cela, Next calcule le plan au moment du build et le fige : une prestation
 * ajoutée ensuite n'y figure jamais. Une heure suffit largement — un robot ne
 * relit pas un sitemap plus souvent — et évite une requête à chaque appel.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const [services, jobs] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { slug: true },
    }),
    // Seules les réalisations publiables : les autres n'ont pas de page.
    prisma.appointment.findMany({
      where: { status: "COMPLETED", publishable: true, photos: { some: {} } },
      orderBy: { finishedAt: "desc" },
      take: 200,
      select: { reference: true, finishedAt: true },
    }),
  ]);

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/reserver`, changeFrequency: "weekly", priority: 0.9 },
    ...services.map((service) => ({
      url: `${base}/${service.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${base}/realisations`, changeFrequency: "weekly" as const, priority: 0.7 },
    ...jobs.map((job) => ({
      url: `${base}/realisations/${job.reference}`,
      lastModified: job.finishedAt ?? undefined,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
