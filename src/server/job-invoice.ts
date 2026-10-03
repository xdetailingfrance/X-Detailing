import { prisma as appClient } from "./db";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatEuros } from "./pricing";

/**
 * Facture d'une prestation (§24).
 *
 * Émise automatiquement à la clôture : le client n'a rien à demander, et le réseau n'a
 * pas de retard de facturation à rattraper. L'opération est **idempotente** — rejouer
 * une clôture ne crée pas un second document, ce qui compte pour une série
 * réglementairement continue.
 *
 * Les montants sont figés ici. Si un tarif change le lendemain, la facture émise ne
 * bouge pas : c'est la règle d'un document comptable.
 */

const VAT_RATE = 0.2;

export type InvoiceLineItem = { label: string; amountCents: number };

/** Le client Prisma à utiliser. Les scripts passent le leur plutôt que le singleton. */
type Client = Pick<PrismaClient, "jobInvoice" | "appointment">;

/** `FP-AAAAMM-NNN`, séquentiel dans le mois, série distincte des factures flotte. */
async function nextNumber(prisma: Client, issuedAt: Date): Promise<string> {
  const prefix = `FP-${issuedAt.getUTCFullYear()}${String(issuedAt.getUTCMonth() + 1).padStart(2, "0")}`;

  const last = await prisma.jobInvoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const rank = last ? Number(last.number.slice(prefix.length + 1)) + 1 : 1;
  return `${prefix}-${String(rank).padStart(3, "0")}`;
}

export type IssueJobInvoiceResult =
  | { ok: true; id: string; number: string; created: boolean }
  | { ok: false; error: string };

export async function issueJobInvoice(
  appointmentId: string,
  prisma: Client = appClient,
): Promise<IssueJobInvoiceResult> {
  const existing = await prisma.jobInvoice.findUnique({
    where: { appointmentId },
    select: { id: true, number: true },
  });
  if (existing) return { ok: true, ...existing, created: false };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true, status: true, customerId: true, reference: true,
      priceCents: true, optionsPriceCents: true, discountCents: true, totalCents: true,
      vehicleClass: true,
      service: { select: { name: true } },
      options: { include: { option: { select: { name: true } } } },
      customerVehicle: { select: { make: true, model: true, plate: true } },
    },
  });

  if (!appointment) return { ok: false, error: "Rendez-vous introuvable." };
  if (appointment.status !== "COMPLETED") {
    return { ok: false, error: "La prestation n'est pas terminée." };
  }

  const vehicle = appointment.customerVehicle;
  const vehicleLabel = vehicle
    ? [vehicle.make, vehicle.model].filter(Boolean).join(" ")
    : "";

  const lines: InvoiceLineItem[] = [
    {
      label: vehicleLabel
        ? `${appointment.service.name} — ${vehicleLabel}`
        : appointment.service.name,
      amountCents: appointment.priceCents,
    },
    ...appointment.options.map((link) => ({
      label: link.option.name,
      amountCents: link.priceCents,
    })),
  ];

  if (appointment.discountCents > 0) {
    lines.push({ label: "Remise", amountCents: -appointment.discountCents });
  }

  // Les prix affichés au client sont TTC : la TVA se déduit du total, elle ne s'y
  // ajoute pas. L'inverse ferait payer 20 % de plus que le montant annoncé.
  const totalCents = appointment.totalCents;
  const subtotalCents = Math.round(totalCents / (1 + VAT_RATE));
  const vatCents = totalCents - subtotalCents;

  const issuedAt = new Date();

  try {
    const invoice = await prisma.jobInvoice.create({
      data: {
        number: await nextNumber(prisma, issuedAt),
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        subtotalCents,
        vatRate: VAT_RATE,
        vatCents,
        totalCents,
        lines: lines as never,
        issuedAt,
      },
      select: { id: true, number: true },
    });

    return { ok: true, ...invoice, created: true };
  } catch (error) {
    // Course entre deux clôtures du même rendez-vous : la contrainte d'unicité a
    // tranché, on relit le document qui a gagné. Toute autre erreur remonte — un
    // `catch` muet transformerait une panne de base en facture silencieusement absente.
    const settled = await prisma.jobInvoice.findUnique({
      where: { appointmentId },
      select: { id: true, number: true },
    });
    if (settled) return { ok: true, ...settled, created: false };
    throw error;
  }
}

/** Facture complète, prête à afficher ou à imprimer. */
export async function getJobInvoice(appointmentId: string) {
  const invoice = await appClient.jobInvoice.findUnique({
    where: { appointmentId },
    include: {
      customer: {
        select: {
          firstName: true, lastName: true, companyName: true,
          email: true, siret: true,
        },
      },
      appointment: {
        select: {
          reference: true, scheduledStart: true, finishedAt: true,
          addressLine1: true, postalCode: true, city: true,
          payments: { select: { method: true, status: true, amountCents: true } },
        },
      },
    },
  });

  if (!invoice) return null;

  return {
    ...invoice,
    lines: invoice.lines as unknown as InvoiceLineItem[],
    formatted: {
      subtotal: formatEuros(invoice.subtotalCents),
      vat: formatEuros(invoice.vatCents),
      total: formatEuros(invoice.totalCents),
    },
  };
}
