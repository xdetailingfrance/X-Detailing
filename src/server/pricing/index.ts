import { prisma } from "../db";
import type { VehicleClass } from "@/generated/prisma/enums";

/**
 * Grille tarifaire (§2) : « calcul automatique du tarif, de la durée et des contraintes
 * nécessaires à l'affectation ».
 *
 * La durée sort d'ici et alimente directement le moteur d'affectation — un tarif et une
 * durée incohérents produiraient des tournées infaisables.
 */

export type QuoteRequest = {
  serviceId: string;
  vehicleClass: VehicleClass;
  optionIds?: string[];
};

export type Quote = {
  serviceName: string;
  basePriceCents: number;
  baseDurationMin: number;
  options: Array<{ id: string; name: string; priceCents: number; durationMin: number }>;
  optionsPriceCents: number;
  optionsDurationMin: number;
  totalCents: number;
  totalDurationMin: number;
};

export class PricingError extends Error {}

export async function quote(request: QuoteRequest): Promise<Quote> {
  const service = await prisma.service.findUnique({
    where: { id: request.serviceId },
    include: { pricing: { where: { vehicleClass: request.vehicleClass } } },
  });

  if (!service) throw new PricingError("Prestation inconnue");

  const pricing = service.pricing[0];
  if (!pricing) {
    throw new PricingError(
      `Aucun tarif défini pour « ${service.name} » sur un véhicule ${request.vehicleClass}`,
    );
  }

  const optionIds = request.optionIds ?? [];
  const options = optionIds.length
    ? await prisma.serviceOption.findMany({ where: { id: { in: optionIds }, active: true } })
    : [];

  if (options.length !== optionIds.length) {
    throw new PricingError("Une option demandée est inconnue ou désactivée");
  }

  const optionsPriceCents = options.reduce((sum, o) => sum + o.priceCents, 0);
  const optionsDurationMin = options.reduce((sum, o) => sum + o.durationMin, 0);

  return {
    serviceName: service.name,
    basePriceCents: pricing.priceCents,
    baseDurationMin: pricing.durationMin,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      priceCents: o.priceCents,
      durationMin: o.durationMin,
    })),
    optionsPriceCents,
    optionsDurationMin,
    totalCents: pricing.priceCents + optionsPriceCents,
    totalDurationMin: pricing.durationMin + optionsDurationMin,
  };
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}
