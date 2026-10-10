import { prisma } from "@/server/db";
import { BUSINESS } from "@/lib/business";
import { JsonLd, localBusinessSchema, serviceSchema } from "@/lib/structured-data";
import { Hero } from "./home/hero";
import { Advantages } from "./home/advantages";
import { Steps } from "./home/steps";
import { Proof, type PublicReview } from "./home/proof";
import { PackComparison } from "./packs";
import { VEHICLES } from "./reserver/vehicles";

/**
 * Accueil — tunnel de conversion.
 *
 * Une seule décision à prendre, et tout la sert : la promesse et le prix d'appel
 * (hero), les engagements en une bande, l'offre et son bouton (packs), ce qui se
 * passe ensuite (trois étapes), puis la preuve.
 *
 * Ce qui a été retiré l'a été parce que ça éloignait du bouton : le bandeau de
 * chiffres, les quatre cartes d'avantages, le configurateur de besoin et
 * l'explorateur de zones. Ces deux derniers vivent sur les pages prestation, où
 * quelqu'un qui compare a la patience de les lire.
 *
 * Les engagements passent avant les packs : ils répondent à « pourquoi vous » pendant
 * que le visiteur descend vers « combien », au lieu de l'arrêter après.
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
  const [services, reviews, sectors] = await Promise.all([
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
      take: 3,
      include: {
        customer: { select: { firstName: true } },
        appointment: { select: { city: true, service: { select: { name: true } } } },
      },
    }),
    prisma.sector.findMany({ where: { active: true }, select: { name: true } }),
  ]);

  const areaServed = sectors.map((sector) => sector.name);

  const classes = VEHICLES.map(([key]) => key).filter((vehicleClass) =>
    services.some((s) => s.pricing.some((p) => p.vehicleClass === vehicleClass)),
  );

  const allPrices = services.flatMap((s) => s.pricing.map((p) => p.priceCents));
  const fromPriceCents = allPrices.length > 0 ? Math.min(...allPrices) : null;

  const publicReviews: PublicReview[] = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    firstName: review.customer.firstName ?? "Client",
    createdAt: review.createdAt,
    serviceName: review.appointment.service.name,
    city: review.appointment.city,
  }));

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

      <Hero fromPriceCents={fromPriceCents} />

      <Advantages />

      {/* ── L'offre ─────────────────────────────────────────────────────── */}
      <section id="packs" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="text-center text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
            Deux formules, un prix ferme.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-body text-xd-text-3">
            L&apos;intérieur, ou l&apos;intérieur et la carrosserie.
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

      <Steps />

      <Proof reviews={publicReviews} />
    </>
  );
}
