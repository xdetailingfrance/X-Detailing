import { prisma } from "./db";
import { getSetting, saveSetting } from "./settings";

/**
 * Fidélité (§37 phase 6).
 *
 * Le cahier des charges ne fixe aucune mécanique : c'est une décision commerciale, pas
 * technique. Le système fournit donc une règle **paramétrable** plutôt qu'une offre
 * figée — « un lavage offert tous les N » ou « X % de remise », au choix du patron.
 *
 * Les récompenses acquises sont enregistrées. Changer la règle ne réécrit jamais ce qui
 * a déjà été promis à un client : c'est la seule façon de ne pas se dédire.
 */

export type LoyaltyRule = {
  enabled: boolean;
  /** Nombre de lavages terminés ouvrant droit à une récompense. */
  everyNWashes: number;
  kind: "DISCOUNT_PERCENT" | "FREE_SERVICE";
  /** Pourcentage de remise, ou plafond en centimes pour une prestation offerte. */
  value: number;
  validityDays: number;
};

export const DEFAULT_LOYALTY: LoyaltyRule = {
  enabled: false,
  everyNWashes: 5,
  kind: "DISCOUNT_PERCENT",
  value: 30,
  validityDays: 180,
};

export const LOYALTY_KEY = "loyalty";

export async function getLoyaltyRule(): Promise<LoyaltyRule> {
  const stored = await getSetting<Partial<LoyaltyRule>>(LOYALTY_KEY);
  return { ...DEFAULT_LOYALTY, ...(stored ?? {}) };
}

export async function saveLoyaltyRule(rule: LoyaltyRule, updatedByUserId: string | null) {
  await saveSetting(LOYALTY_KEY, rule, updatedByUserId, "Règle de fidélité (§37 phase 6)");
}

/**
 * Attribue les récompenses dues. Idempotent : relancer la tâche ne double jamais une
 * récompense, puisqu'on compare le nombre acquis au nombre mérité.
 */
export async function grantDueRewards(): Promise<Record<string, number>> {
  const rule = await getLoyaltyRule();
  if (!rule.enabled || rule.everyNWashes < 1) return { attribuées: 0, ignorées: 0 };

  const customers = await prisma.customer.findMany({
    where: { appointments: { some: { status: "COMPLETED" } } },
    select: {
      id: true,
      _count: { select: { appointments: { where: { status: "COMPLETED" } } } },
      rewards: { select: { id: true } },
    },
  });

  let granted = 0;

  for (const customer of customers) {
    const earned = Math.floor(customer._count.appointments / rule.everyNWashes);
    const missing = earned - customer.rewards.length;
    if (missing <= 0) continue;

    for (let i = 0; i < missing; i++) {
      await prisma.customerReward.create({
        data: {
          customerId: customer.id,
          kind: rule.kind,
          value: rule.value,
          earnedAfterWashes: (customer.rewards.length + i + 1) * rule.everyNWashes,
          expiresAt:
            rule.validityDays > 0
              ? new Date(Date.now() + rule.validityDays * 24 * 3600_000)
              : null,
        },
      });
      granted += 1;
    }
  }

  return { attribuées: granted, clients: customers.length };
}

export type AvailableReward = {
  id: string;
  kind: LoyaltyRewardKind;
  value: number;
  earnedAfterWashes: number;
  expiresAt: Date | null;
};

type LoyaltyRewardKind = LoyaltyRule["kind"];

/** Récompense utilisable la plus ancienne — on consomme d'abord celle qui expire. */
export async function getAvailableReward(customerId: string): Promise<AvailableReward | null> {
  return prisma.customerReward.findFirst({
    where: {
      customerId,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ expiresAt: "asc" }, { earnedAt: "asc" }],
    select: { id: true, kind: true, value: true, earnedAfterWashes: true, expiresAt: true },
  });
}

/** Montant de la remise, plafonné au total de la prestation. */
export function rewardDiscountCents(reward: AvailableReward, totalCents: number): number {
  if (reward.kind === "DISCOUNT_PERCENT") {
    return Math.min(totalCents, Math.round((totalCents * reward.value) / 100));
  }
  // Prestation offerte : `value` sert de plafond, pour qu'un lavage à 99 € ne soit pas
  // offert au titre d'une récompense acquise sur des lavages à 29 €.
  return Math.min(totalCents, reward.value > 0 ? reward.value : totalCents);
}
