import { prisma } from "@/server/db";
import { BUSINESS } from "@/lib/business";
import { JsonLd, localBusinessSchema, serviceSchema } from "@/lib/structured-data";
import { Hero } from "./home/hero";
import { NeedsConfigurator } from "./home/needs";
import { CarZones } from "./home/car-zones";
import { Method } from "./home/method";
import { Proof, type PublicReview } from "./home/proof";
import { PackComparison } from "./packs";
import { VEHICLES } from "./reserver/vehicles";

/**
 * Accueil.
 *
 * L'ordre suit une décision, pas un sommaire : qui nous sommes et où (hero), ce dont
 * votre voiture a besoin (configurateur), ce que valent les deux formules, ce qui est
 * traité sur le véhicule, comment on travaille, et ce que ça donne.
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
  const [services, reviews] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { pricing: true, options: { select: { optionId: true } } },
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
  ]);

  const [options, sectors] = await Promise.all([
    prisma.serviceOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.sector.findMany({ where: { active: true }, select: { name: true } }),
  ]);

  const areaServed = sectors.map((sector) => sector.name);

  const classes = VEHICLES.map(([key]) => key).filter((vehicleClass) =>
    services.some((s) => s.pricing.some((p) => p.vehicleClass === vehicleClass)),
  );

  const durations = services.flatMap((s) => s.pricing.map((p) => p.durationMin));

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

      <Hero />

      <NeedsConfigurator
        services={services.map((service) => ({
          id: service.id,
          code: service.code,
          name: service.name,
          tier: service.tier,
          includes: service.includes,
          pricing: Object.fromEntries(
            service.pricing.map((p) => [
              p.vehicleClass,
              { priceCents: p.priceCents, durationMin: p.durationMin },
            ]),
          ),
        }))}
        options={options.map((option) => ({
          id: option.id,
          code: option.code,
          name: option.name,
          priceCents: option.priceCents,
          durationMin: option.durationMin,
        }))}
      />

      {/* ── Les deux formules ───────────────────────────────────────────── */}
      <section id="formules" className="scroll-mt-24 border-y border-white/[0.06] bg-xd-abyss/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
            Deux formules. Pas quinze.
          </h2>
          <p className="mt-4 max-w-xl text-body text-xd-text-3">
            L&apos;intérieur, ou l&apos;intérieur et la carrosserie. Choisissez votre
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

      <CarZones />

      <Method
        shortestMin={Math.min(...durations)}
        longestMin={Math.max(...durations)}
      />

      <Proof reviews={publicReviews} />
    </>
  );
}
