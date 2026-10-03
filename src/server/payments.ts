import { prisma } from "./db";
import { recordAudit } from "./audit";
import { raiseAlert, resolveAlerts } from "./quality/alerts";
import { paymentProvider } from "@/lib/providers/payments";
import { formatEuros } from "./pricing";

/**
 * Encaissement client (§16).
 *
 * « Le système distingue acompte déjà encaissé, solde, montant total, mode de paiement
 * et bénéficiaire des fonds. » Ces cinq informations sont portées par chaque `Payment` ;
 * ce module ne fait que les combiner et faire respecter la règle de l'écart de caisse.
 */

export type PaymentSummary = {
  totalCents: number;
  depositPaidCents: number;
  otherPaidCents: number;
  paidCents: number;
  balanceCents: number;
  pendingCents: number;
  discrepancyCents: number;
  settled: boolean;
};

export async function getPaymentSummary(appointmentId: string): Promise<PaymentSummary> {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: {
      totalCents: true,
      payments: {
        select: { kind: true, status: true, amountCents: true, discrepancyCents: true },
      },
    },
  });

  const paid = appointment.payments.filter((p) => p.status === "PAID");
  const depositPaidCents = paid
    .filter((p) => p.kind === "DEPOSIT")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const otherPaidCents = paid
    .filter((p) => p.kind !== "DEPOSIT")
    .reduce((sum, p) => sum + p.amountCents, 0);

  const paidCents = depositPaidCents + otherPaidCents;
  const discrepancyCents = appointment.payments.reduce((sum, p) => sum + p.discrepancyCents, 0);

  return {
    totalCents: appointment.totalCents,
    depositPaidCents,
    otherPaidCents,
    paidCents,
    balanceCents: Math.max(0, appointment.totalCents - paidCents),
    pendingCents: appointment.payments
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + p.amountCents, 0),
    discrepancyCents,
    settled: paidCents >= appointment.totalCents && discrepancyCents === 0,
  };
}

export type CashResult =
  | { ok: true; discrepancyCents: number; summary: PaymentSummary }
  | { ok: false; error: string };

/**
 * Encaissement en espèces (§16).
 *
 * « Pour les espèces : saisie du montant attendu et du montant reçu. Si le montant reçu
 * ne correspond pas, alerte et blocage de la clôture. »
 *
 * L'écart est **enregistré**, pas refusé : l'opérateur a déjà les billets en main, nier
 * l'écart ne le ferait pas disparaître. Il est tracé, alerté, et bloque la clôture.
 */
export async function recordCashPayment(input: {
  appointmentId: string;
  operatorId: string;
  expectedCents: number;
  receivedCents: number;
  actor: { userId: string | null; label: string };
}): Promise<CashResult> {
  if (input.receivedCents < 0 || input.expectedCents <= 0) {
    return { ok: false, error: "Montant invalide." };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: { id: true, reference: true, operatorId: true, status: true },
  });
  if (!appointment) return { ok: false, error: "Rendez-vous introuvable." };
  if (appointment.operatorId !== input.operatorId) {
    return { ok: false, error: "Ce rendez-vous n'est pas le vôtre." };
  }
  if (appointment.status !== "PAYMENT") {
    return { ok: false, error: "L'encaissement n'est pas ouvert pour ce rendez-vous." };
  }

  const discrepancyCents = input.receivedCents - input.expectedCents;

  await prisma.payment.create({
    data: {
      appointmentId: input.appointmentId,
      kind: "BALANCE",
      method: "CASH",
      status: "PAID",
      // §38 point 5 : X Detailing encaisse l'ensemble des prestations et reverse à la
      // quinzaine. Les espèces appartiennent donc à X Detailing dès l'encaissement ;
      // l'opérateur les détient simplement, et elles seront déduites de son virement.
      beneficiary: "XDETAILING",
      amountCents: input.expectedCents,
      receivedCents: input.receivedCents,
      discrepancyCents,
      collectedByOperatorId: input.operatorId,
      paidAt: new Date(),
    },
  });

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: "ESPECES_ENCAISSEES",
    entityType: "Appointment",
    entityId: input.appointmentId,
    after: {
      expectedCents: input.expectedCents,
      receivedCents: input.receivedCents,
      discrepancyCents,
    },
  });

  if (discrepancyCents !== 0) {
    await raiseAlert({
      type: "CASH_MISMATCH",
      severity: "CRITICAL",
      title: `Écart de caisse — ${appointment.reference}`,
      message:
        `Attendu ${formatEuros(input.expectedCents)}, reçu ${formatEuros(input.receivedCents)} ` +
        `(écart ${formatEuros(discrepancyCents)}). La clôture est bloquée.`,
      appointmentId: input.appointmentId,
      operatorId: input.operatorId,
    });
  } else {
    await resolveAlerts(input.appointmentId, ["CASH_MISMATCH", "PAYMENT_MISSING"]);
  }

  return {
    ok: true,
    discrepancyCents,
    summary: await getPaymentSummary(input.appointmentId),
  };
}

export type LinkResult = { ok: true; url: string } | { ok: false; error: string };

/** §16 — « l'opérateur peut envoyer un lien de paiement depuis son application ». */
export async function createBalanceLink(input: {
  appointmentId: string;
  operatorId: string;
  actor: { userId: string | null; label: string };
}): Promise<LinkResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true, reference: true, operatorId: true, status: true,
      service: { select: { name: true } },
      customer: { select: { email: true, phone: true } },
    },
  });

  if (!appointment) return { ok: false, error: "Rendez-vous introuvable." };
  if (appointment.operatorId !== input.operatorId) {
    return { ok: false, error: "Ce rendez-vous n'est pas le vôtre." };
  }

  const summary = await getPaymentSummary(input.appointmentId);
  if (summary.balanceCents <= 0) return { ok: false, error: "Il n'y a plus rien à encaisser." };

  const provider = paymentProvider();
  const link = await provider.createPaymentLink({
    appointmentReference: appointment.reference,
    amountCents: summary.balanceCents,
    label: `Solde ${appointment.service.name}`,
    customerEmail: appointment.customer.email,
    customerPhone: appointment.customer.phone,
  });

  await prisma.payment.create({
    data: {
      appointmentId: input.appointmentId,
      kind: "BALANCE",
      method: "CARD_LINK",
      // Tant qu'aucun prestataire n'est acté, le paiement reste en attente : la
      // transition vers PAID se fera sur webhook, jamais sur un clic opérateur (§16).
      status: "PENDING",
      beneficiary: "XDETAILING",
      amountCents: summary.balanceCents,
      providerRef: link.providerRef,
      providerPayload: { url: link.url, provider: provider.name },
    },
  });

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: "LIEN_PAIEMENT_ENVOYE",
    entityType: "Appointment",
    entityId: input.appointmentId,
    after: { amountCents: summary.balanceCents, provider: provider.name },
  });

  return { ok: true, url: link.url };
}
