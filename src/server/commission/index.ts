import type { Prisma } from "@/generated/prisma/client";

/**
 * Commission réseau (§18).
 *
 * 18 % du chiffre d'affaires de lavage, hors dépenses publicitaires (§19, suivies
 * séparément dans `AdSpend`).
 *
 * La commission est **figée** à la clôture de la prestation : un changement de taux ne
 * doit jamais réécrire le passé. Le taux appliqué est celui de l'opérateur au moment des
 * faits, stocké avec le montant.
 */

export type CommissionInput = {
  appointmentId: string;
  operatorId: string;
  /** Base de calcul : le CA de la prestation, options comprises. */
  baseCents: number;
  rate: Prisma.Decimal | number;
  at: Date;
};

export function computeCommission(input: CommissionInput) {
  const rate = Number(input.rate);
  return {
    appointmentId: input.appointmentId,
    operatorId: input.operatorId,
    baseCents: input.baseCents,
    rate,
    amountCents: Math.round(input.baseCents * rate),
    periodYear: input.at.getFullYear(),
    periodMonth: input.at.getMonth() + 1,
  };
}
