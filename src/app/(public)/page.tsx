import { prisma } from "@/server/db";
import { BUSINESS } from "@/lib/business";
import { JsonLd, localBusinessSchema, serviceSchema } from "@/lib/structured-data";
import { Hero } from "./home/hero";
import { Stats, buildStats } from "./home/stats";
import { Advantages } from "./home/advantages";
import { Proof, type PublicReview } from "./home/proof";
import { PackComparison } from "./packs";
import { VEHICLES } from "./reserver/vehicles";

/**
 * Accueil — page de capture.
 *
 * L'ordre mène à une seule action : réserver. Qui nous sommes (hero), ce que ça
 * représente (chiffres), pourquoi nous (quatre engagements), combien (les deux packs,
 * par véhicule), et la preuve (transformations, avis).
 *
 * Le configurateur de besoin et l'explorateur de zones ont quitté cette page : ils
 * demandaient quatre décisions avant d'arriver au prix. Ils vivent toujours sur les
 * pages prestation, où quelqu'un qui compare a vraiment la patience de les lire.
 *
 * Rendu à la demande, jamais pré-rendu : la grille tarifaire vient de la base et un
 * changement de prix doit être visible immédiatement, pas au prochain déploiement.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: `Lavage et detailing automobile à ${BUSINESS.city} · ${BUSINESS.name}`,
  description:
    "Nettoyage intérieur et extérieur de votre véhicule, à domicile ou sur votre lieu " +
    "de travail. Prix ferme, photos avant et après, réservation en ligne.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [services, reviews, sectors, completedCount, ratings] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { pricing: true },
    }),
    // Avis réels, les plus récents. Rien n'est écrit ici : ce que le client a noté, et
    // rien d'autre.
    prisma.review.findMany({
      where: { comment: { not: null }, rating: { gte: 4 } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        customer: { select: { firstName: true } },
        appointment: { select: { city: true, service: { select: { name: true } } } },
      },
    }),
    prisma.sector.findMany({ where: { active: true }, select: { name: true } }),
    prisma.appointment.count({ where: { status: "COMPLETED" } }),
    // La moyenne porte sur tous les avis, pas seulement ceux affichés : ne retenir que
    // les quatre et cinq étoiles donnerait une note que personne n'a donnée.
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
  ]);

  const areaServed = sectors.map((sector) => sector.name);

  const classes = VEHICLES.map(([key]) => key).filter((vehicleClass) =>
    services.some((s) => s.pricing.some((p) => p.vehicleClass === vehicleClass)),
  );

  const publicReviews: PublicReview[] = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    firstName: review.customer.firstName ?? "Client",
    createdAt: review.createdAt,
    serviceName: review.appointment.service.name,
    city: review.appointment.city,
  }));

  const stats = buildStats({
    completedCount,
    averageRating: ratings._avg.rating,
    reviewCount: ratings._count._all,
    sectorCount: sectors.length,
  });

  return (
    <>
      <JsonLd
        data={[
          localBusinessSchema(areaServed),
          ...services.map((service) =>
            serviceSchema(
              {
                name: service.name,
                description: service.description,
                lowestPriceCents: Math.min(...service.pricing.map((p) => p.priceCents)),
              },
              areaServed,
            ),
          ),
        ]}
      />

      <Hero />

      <Stats stats={stats} />

      <Advantages />

      {/* ── Choisis ton pack ────────────────────────────────────────────── */}
      <section id="packs" className="scroll-mt-24 border-y border-white/[0.06] bg-xd-abyss/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
            Choisissez votre pack.
          </h2>
          <p className="mt-4 max-w-xl text-body text-xd-text-3">
            L&apos;intérieur, ou l&apos;intérieur et la carrosserie. Sélectionnez votre
            véhicule&nbsp;: le prix affiché est celui qui sera facturé.
          </p>

          <PackComparison
            packs={services.map((service) => ({
              id: service.id,
              name: service.name,
              description: service.description,
              tier: service.tier,
              includes: service.includes,
              pricing: service.pricing.map((p) => ({
                vehicleClass: p.vehicleClass,
                priceCents: p.priceCents,
                compareAtCents: p.compareAtCents,
                durationMin: p.durationMin,
              })),
            }))}
            vehicles={classes.map((vehicleClass) => ({
              key: vehicleClass,
              label: VEHICLES.find(([k]) => k === vehicleClass)?.[1] ?? vehicleClass,
            }))}
          />
        </div>
      </section>

      <Proof reviews={publicReviews} />
    </>
  );
}
