import { prisma } from "@/server/db";
import { toLocalDateInput } from "@/server/time";
import { getQuotingRule } from "@/server/quoting";
import { visionProvider } from "@/lib/providers/vision";
import { BookingFunnel, type FunnelOption, type FunnelService } from "./booking-funnel";
import { VEHICLE_CLASSES, type FunnelVehicleClass } from "./vehicles";

/**
 * Rendu à la demande, jamais pré-rendu : la grille tarifaire vient de la base, et un
 * changement de prix doit être visible immédiatement, pas au prochain déploiement.
 * Cela évite aussi d'exiger un accès base au moment du build.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Réserver un lavage · X Detailing",
  description: "Choisissez votre véhicule, votre prestation et votre créneau en 2 minutes.",
};

/** Les 14 prochains jours, calculés hors du corps de rendu. */
async function upcomingDays(): Promise<string[]> {
  const today = Date.now();
  return Array.from({ length: 14 }, (_, i) =>
    toLocalDateInput(new Date(today + i * 24 * 3600_000)),
  );
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicule?: string; prestation?: string }>;
}) {
  const { vehicule, prestation } = await searchParams;
  const [services, options] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { pricing: true, options: { select: { optionId: true } } },
    }),
    prisma.serviceOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const funnelServices: FunnelService[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    kind: service.kind,
    includes: service.includes,
    featured: service.featured,
    tier: service.tier,
    optionIds: service.options.map((o) => o.optionId),
    pricing: Object.fromEntries(
      service.pricing.map((p) => [
        p.vehicleClass,
        { priceCents: p.priceCents, durationMin: p.durationMin },
      ]),
    ),
  }));

  const funnelOptions: FunnelOption[] = options.map((option) => ({
    id: option.id,
    name: option.name,
    priceCents: option.priceCents,
    durationMin: option.durationMin,
  }));

  return (
    <BookingFunnel
      preset={{
        // On ne retient que ce qui existe réellement : un paramètre d'URL inventé
        // ne doit pas ouvrir le tunnel sur une prestation introuvable.
        vehicleClass: VEHICLE_CLASSES.includes(vehicule as never)
          ? (vehicule as FunnelVehicleClass)
          : null,
        serviceId: funnelServices.some((s) => s.id === prestation) ? prestation! : null,
      }}
      services={funnelServices}
      options={funnelOptions}
      days={await upcomingDays()}
      depositRate={(await getQuotingRule()).depositRate}
      analysisAvailable={visionProvider().available}
    />
  );
}
