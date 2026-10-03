import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { getQuotingRule } from "@/server/quoting";
import { PageHeader } from "@/components/ui";
import { QuoteBuilder } from "./quote-builder";

export const metadata = { title: "Devis express · X Detailing OS" };
export const dynamic = "force-dynamic";

/**
 * Devis au téléphone (§3).
 *
 * Le conseiller a un prospect en ligne et quinze secondes pour annoncer un prix. Le
 * formulaire de rendez-vous, lui, demande une adresse, un créneau, un opérateur — tout
 * ce qui n'a pas encore de sens tant que le client n'a pas dit oui. D'où cet écran :
 * trois choix, un montant, et un passage en réservation si l'appel aboutit.
 *
 * Tout le calcul se fait dans le navigateur à partir de la grille chargée ici : au
 * téléphone, un aller-retour réseau par clic s'entend.
 */
export default async function QuotePage() {
  await requireBackOffice();

  const [services, options, quoting] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { pricing: true, options: { select: { optionId: true } } },
    }),
    prisma.serviceOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getQuotingRule(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis express"
        lead="Un prospect au téléphone : catégorie, prestation, options — le montant s'affiche pendant que vous parlez."
      />

      <QuoteBuilder
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          optionIds: service.options.map((o) => o.optionId),
          pricing: Object.fromEntries(
            service.pricing.map((p) => [
              p.vehicleClass,
              { priceCents: p.priceCents, durationMin: p.durationMin },
            ]),
          ),
        }))}
        options={options.map((option) => ({
          id: option.id,
          name: option.name,
          priceCents: option.priceCents,
          durationMin: option.durationMin,
        }))}
        quoting={quoting}
      />
    </div>
  );
}
