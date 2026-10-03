import { prisma } from "./db";
import { recordAudit } from "./audit";
import { startOfLocalDay, zonedParts } from "./time";

/**
 * Reversements aux opérateurs (§18, §38 point 5).
 *
 * Modèle retenu : **X Detailing encaisse l'ensemble des prestations et reverse aux
 * indépendants toutes les deux semaines.**
 *
 * La quinzaine est calée sur le calendrier (1–15, puis 16–fin de mois) plutôt que sur
 * un cycle glissant de 14 jours : elle s'aligne ainsi sur la facturation des comptes
 * entreprise et sur les périodes de TVA, sans quoi un reversement chevaucherait deux
 * mois comptables une quinzaine sur deux.
 *
 * Quatre montants sont distingués, parce qu'ils ne se compensent pas au même titre :
 *   CA produit − commission − contribution publicitaire = net gagné
 *   net gagné − espèces déjà détenues + régularisations  = virement
 */

const BILLABLE_STATUS = "COMPLETED";

export type Fortnight = { start: Date; end: Date; label: string };

/** Quinzaine contenant `date`. */
export function fortnightOf(date: Date): Fortnight {
  const { year, month, day } = zonedParts(date);
  const first = day <= 15;

  const start = startOfLocalDay(new Date(Date.UTC(year, month - 1, first ? 1 : 16, 12)));
  const end = first
    ? startOfLocalDay(new Date(Date.UTC(year, month - 1, 16, 12)))
    : startOfLocalDay(new Date(Date.UTC(year, month, 1, 12)));

  const lastDay = new Date(end.getTime() - 12 * 3600_000);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    month: "long",
    year: "numeric",
  }).format(start);

  return {
    start,
    end,
    label: `${first ? "1er" : "16"}–${zonedParts(lastDay).day} ${monthLabel}`,
  };
}

/** Quinzaine précédente : celle qu'on reverse en pratique, une fois close. */
export function previousFortnight(date = new Date()): Fortnight {
  const current = fortnightOf(date);
  return fortnightOf(new Date(current.start.getTime() - 24 * 3600_000));
}

export type SettlementDraft = {
  operatorId: string;
  operatorCode: string;
  operatorName: string;
  period: Fortnight;
  jobCount: number;
  totalRevenueCents: number;
  commissionCents: number;
  commissionRate: number;
  cashHeldCents: number;
  cardCollectedCents: number;
  adContributionCents: number;
  netCents: number;
  payoutCents: number;
  existingId: string | null;
  existingStatus: string | null;
};

/**
 * Quote-part publicitaire d'une quinzaine (§19).
 *
 * La contribution est plafonnée au mois ; on en impute la moitié par quinzaine plutôt
 * que la totalité sur la première, sans quoi le premier virement du mois serait
 * systématiquement amputé.
 */
async function adContributionFor(
  operatorId: string,
  period: Fortnight,
): Promise<number> {
  const { year, month } = zonedParts(period.start);

  const spend = await prisma.adSpend.findUnique({
    where: { operatorId_periodYear_periodMonth: { operatorId, periodYear: year, periodMonth: month } },
    select: { chargedCents: true },
  });

  return Math.round((spend?.chargedCents ?? 0) / 2);
}

export async function prepareSettlement(
  operatorId: string,
  period: Fortnight,
): Promise<SettlementDraft | null> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, code: true, firstName: true, lastName: true, commissionRate: true },
  });
  if (!operator) return null;

  const [appointments, commissions, payments, existing] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        operatorId,
        status: BILLABLE_STATUS,
        finishedAt: { gte: period.start, lt: period.end },
      },
      select: { id: true, totalCents: true },
    }),
    prisma.commission.findMany({
      where: {
        operatorId,
        settlementId: null,
        appointment: { finishedAt: { gte: period.start, lt: period.end } },
      },
      select: { amountCents: true },
    }),
    prisma.payment.findMany({
      where: {
        status: "PAID",
        collectedByOperatorId: operatorId,
        paidAt: { gte: period.start, lt: period.end },
      },
      select: { method: true, amountCents: true },
    }),
    prisma.settlement.findUnique({
      where: { operatorId_periodStart: { operatorId, periodStart: period.start } },
      select: { id: true, status: true },
    }),
  ]);

  const totalRevenueCents = appointments.reduce((sum, a) => sum + a.totalCents, 0);
  const commissionCents = commissions.reduce((sum, c) => sum + c.amountCents, 0);
  const cashHeldCents = payments
    .filter((p) => p.method === "CASH")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const cardCollectedCents = payments
    .filter((p) => p.method !== "CASH")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const adContributionCents = await adContributionFor(operatorId, period);
  const netCents = totalRevenueCents - commissionCents - adContributionCents;

  return {
    operatorId: operator.id,
    operatorCode: operator.code,
    operatorName: `${operator.firstName} ${operator.lastName}`,
    period,
    jobCount: appointments.length,
    totalRevenueCents,
    commissionCents,
    commissionRate: Number(operator.commissionRate),
    cashHeldCents,
    cardCollectedCents,
    adContributionCents,
    netCents,
    payoutCents: netCents - cashHeldCents,
    existingId: existing?.id ?? null,
    existingStatus: existing?.status ?? null,
  };
}

export async function prepareAllSettlements(period: Fortnight): Promise<SettlementDraft[]> {
  const operators = await prisma.operator.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { code: "asc" },
    select: { id: true },
  });

  const drafts = await Promise.all(
    operators.map((operator) => prepareSettlement(operator.id, period)),
  );

  return drafts.filter((draft): draft is SettlementDraft => draft !== null);
}

/** `RV-AAAAMMQ-NN` : période, quinzaine, puis rang de l'opérateur. */
async function nextReference(period: Fortnight): Promise<string> {
  const { year, month, day } = zonedParts(period.start);
  const prefix = `RV-${year}${String(month).padStart(2, "0")}${day <= 15 ? "A" : "B"}`;

  const last = await prisma.settlement.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const next = last ? Number(last.reference.split("-")[2]) + 1 : 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
}

export type IssueSettlementResult =
  | { ok: true; settlementId: string; reference: string; payoutCents: number }
  | { ok: false; error: string };

export async function issueSettlement(input: {
  operatorId: string;
  period: Fortnight;
  adjustmentCents?: number;
  adjustmentNote?: string | null;
  actor: { userId: string | null; label: string };
}): Promise<IssueSettlementResult> {
  const draft = await prepareSettlement(input.operatorId, input.period);
  if (!draft) return { ok: false, error: "Opérateur introuvable." };
  if (draft.existingId) return { ok: false, error: "Un reversement existe déjà pour cette quinzaine." };
  if (draft.jobCount === 0) return { ok: false, error: "Aucune prestation terminée sur cette quinzaine." };

  const adjustmentCents = input.adjustmentCents ?? 0;
  const payoutCents = draft.payoutCents + adjustmentCents;
  const reference = await nextReference(input.period);

  const settlement = await prisma.$transaction(async (tx) => {
    const created = await tx.settlement.create({
      data: {
        reference,
        operatorId: draft.operatorId,
        periodStart: input.period.start,
        periodEnd: input.period.end,
        jobCount: draft.jobCount,
        totalRevenueCents: draft.totalRevenueCents,
        commissionCents: draft.commissionCents,
        cashHeldCents: draft.cashHeldCents,
        adContributionCents: draft.adContributionCents,
        adjustmentCents,
        adjustmentNote: input.adjustmentNote ?? null,
        netCents: draft.netCents,
        payoutCents,
        status: "ISSUED",
        issuedAt: new Date(),
      },
      select: { id: true, reference: true },
    });

    // Rattacher les commissions au reversement : c'est ce qui les rend non
    // reversables une seconde fois, sur le modèle des lignes de facture (§24).
    await tx.commission.updateMany({
      where: {
        operatorId: draft.operatorId,
        settlementId: null,
        appointment: { finishedAt: { gte: input.period.start, lt: input.period.end } },
      },
      data: { settlementId: created.id, settledAt: new Date() },
    });

    return created;
  });

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: "REVERSEMENT_EMIS",
    entityType: "Settlement",
    entityId: settlement.id,
    after: {
      reference: settlement.reference,
      operateur: draft.operatorName,
      periode: input.period.label,
      caProduit: draft.totalRevenueCents,
      commission: draft.commissionCents,
      especesDetenues: draft.cashHeldCents,
      virement: payoutCents,
    },
  });

  return { ok: true, settlementId: settlement.id, reference: settlement.reference, payoutCents };
}

export async function markSettlementPaid(input: {
  settlementId: string;
  paymentRef?: string | null;
  actor: { userId: string | null; label: string };
}): Promise<{ ok: boolean; error?: string }> {
  const settlement = await prisma.settlement.findUnique({
    where: { id: input.settlementId },
    select: { id: true, reference: true, status: true },
  });

  if (!settlement) return { ok: false, error: "Reversement introuvable." };
  if (settlement.status === "PAID") return { ok: false, error: "Reversement déjà viré." };

  await prisma.settlement.update({
    where: { id: settlement.id },
    data: { status: "PAID", paidAt: new Date(), paymentRef: input.paymentRef?.trim() || null },
  });

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: "REVERSEMENT_VIRE",
    entityType: "Settlement",
    entityId: settlement.id,
    before: { status: settlement.status },
    after: { status: "PAID", paymentRef: input.paymentRef ?? null },
  });

  return { ok: true };
}
