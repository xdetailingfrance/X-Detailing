import { prisma } from "./db";
import { recordAudit } from "./audit";
import { startOfLocalMonth, addMonths } from "./time";
import { formatEuros } from "./pricing";

/**
 * Facturation des comptes entreprise (§24).
 *
 * « Possibilité de gérer une flotte, des responsables et des factures selon le modèle
 * comptable retenu. »
 *
 * Un particulier règle à chaque prestation ; une flotte règle une facture mensuelle
 * récapitulative. Le taux de TVA est porté par la facture, pas codé en dur : le §38
 * point 5 n'est pas tranché, et une facture émise ne doit jamais changer rétroactivement
 * parce qu'un réglage a bougé.
 */

const DEFAULT_VAT_RATE = 0.2;

export type InvoicePreview = {
  customerId: string;
  companyName: string;
  periodYear: number;
  periodMonth: number;
  lines: Array<{ appointmentId: string; label: string; amountCents: number }>;
  subtotalCents: number;
  vatRate: number;
  vatCents: number;
  totalCents: number;
  /** Déjà facturé pour cette période : une facture existe. */
  existingInvoiceId: string | null;
};

function periodBounds(year: number, month: number) {
  const reference = new Date(Date.UTC(year, month - 1, 15, 12));
  const start = startOfLocalMonth(reference);
  return { start, end: addMonths(reference, 1) };
}

export async function previewInvoice(
  customerId: string,
  year: number,
  month: number,
): Promise<InvoicePreview | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, type: true, companyName: true, firstName: true, lastName: true },
  });
  if (!customer) return null;

  const { start, end } = periodBounds(year, month);

  const appointments = await prisma.appointment.findMany({
    where: {
      customerId,
      status: "COMPLETED",
      scheduledStart: { gte: start, lt: end },
      // Une prestation déjà rattachée à une facture n'est jamais refacturée.
      invoiceLine: null,
    },
    orderBy: { scheduledStart: "asc" },
    select: {
      id: true, reference: true, totalCents: true, scheduledStart: true, city: true,
      service: { select: { name: true } },
      customerVehicle: { select: { make: true, model: true, plate: true } },
    },
  });

  const existing = await prisma.invoice.findUnique({
    where: { customerId_periodYear_periodMonth: { customerId, periodYear: year, periodMonth: month } },
    select: { id: true },
  });

  const lines = appointments.map((appointment) => {
    const vehicle = appointment.customerVehicle;
    const vehicleLabel = vehicle
      ? [vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" ")
      : "";

    return {
      appointmentId: appointment.id,
      label:
        `${appointment.reference} · ${appointment.service.name}` +
        (vehicleLabel ? ` · ${vehicleLabel}` : "") +
        ` · ${appointment.city}`,
      amountCents: appointment.totalCents,
    };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const vatCents = Math.round(subtotalCents * DEFAULT_VAT_RATE);

  return {
    customerId,
    companyName:
      customer.companyName ??
      `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
    periodYear: year,
    periodMonth: month,
    lines,
    subtotalCents,
    vatRate: DEFAULT_VAT_RATE,
    vatCents,
    totalCents: subtotalCents + vatCents,
    existingInvoiceId: existing?.id ?? null,
  };
}

/** `FA-AAAAMM-NNN`, séquentiel dans le mois. */
async function nextInvoiceNumber(year: number, month: number): Promise<string> {
  const prefix = `FA-${year}${String(month).padStart(2, "0")}`;
  const last = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const next = last ? Number(last.number.split("-")[2]) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

export type IssueResult = { ok: true; invoiceId: string; number: string } | { ok: false; error: string };

export async function issueInvoice(input: {
  customerId: string;
  year: number;
  month: number;
  actor: { userId: string | null; label: string };
}): Promise<IssueResult> {
  const preview = await previewInvoice(input.customerId, input.year, input.month);
  if (!preview) return { ok: false, error: "Client introuvable." };
  if (preview.existingInvoiceId) return { ok: false, error: "Une facture existe déjà pour cette période." };
  if (preview.lines.length === 0) return { ok: false, error: "Aucune prestation à facturer sur cette période." };

  const number = await nextInvoiceNumber(input.year, input.month);
  const issuedAt = new Date();

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        number,
        customerId: input.customerId,
        periodYear: input.year,
        periodMonth: input.month,
        status: "ISSUED",
        subtotalCents: preview.subtotalCents,
        vatRate: preview.vatRate,
        vatCents: preview.vatCents,
        totalCents: preview.totalCents,
        issuedAt,
        // Paiement à 30 jours, usage courant entre professionnels.
        dueAt: new Date(issuedAt.getTime() + 30 * 24 * 3600_000),
        lines: {
          create: preview.lines.map((line) => ({
            appointmentId: line.appointmentId,
            label: line.label,
            amountCents: line.amountCents,
          })),
        },
      },
      select: { id: true, number: true },
    });

    return created;
  });

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: "FACTURE_EMISE",
    entityType: "Invoice",
    entityId: invoice.id,
    after: {
      number: invoice.number,
      periode: `${input.year}-${String(input.month).padStart(2, "0")}`,
      lignes: preview.lines.length,
      total: formatEuros(preview.totalCents),
    },
  });

  return { ok: true, invoiceId: invoice.id, number: invoice.number };
}

export async function markInvoicePaid(input: {
  invoiceId: string;
  actor: { userId: string | null; label: string };
}): Promise<{ ok: boolean; error?: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, number: true, status: true },
  });

  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (invoice.status === "PAID") return { ok: false, error: "Facture déjà réglée." };

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  await recordAudit({
    actorUserId: input.actor.userId,
    actorLabel: input.actor.label,
    action: "FACTURE_REGLEE",
    entityType: "Invoice",
    entityId: invoice.id,
    before: { status: invoice.status },
    after: { status: "PAID" },
  });

  return { ok: true };
}

export type FleetSummary = {
  id: string;
  companyName: string;
  siret: string | null;
  phone: string;
  email: string | null;
  vehicleCount: number;
  addressCount: number;
  contactCount: number;
  washesThisYear: number;
  revenueYearCents: number;
  /** Jours moyens entre deux lavages, sur l'année. `null` si moins de deux lavages. */
  averageIntervalDays: number | null;
  unpaidInvoices: number;
  unpaidCents: number;
};

/** §24 — « statistiques de CA et fréquence de lavage pour les comptes professionnels ». */
export async function getFleetAccounts(now = new Date()): Promise<FleetSummary[]> {
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));

  const customers = await prisma.customer.findMany({
    where: { type: "BUSINESS" },
    orderBy: { companyName: "asc" },
    select: {
      id: true, companyName: true, siret: true, phone: true, email: true,
      _count: { select: { vehicles: true, addresses: true, contacts: true } },
      appointments: {
        where: { status: "COMPLETED", scheduledStart: { gte: yearStart } },
        orderBy: { scheduledStart: "asc" },
        select: { scheduledStart: true, totalCents: true },
      },
      invoices: {
        where: { status: "ISSUED" },
        select: { totalCents: true },
      },
    },
  });

  return customers.map((customer) => {
    const washes = customer.appointments;
    const first = washes[0]?.scheduledStart;
    const last = washes.at(-1)?.scheduledStart;

    return {
      id: customer.id,
      companyName: customer.companyName ?? "Compte entreprise",
      siret: customer.siret,
      phone: customer.phone,
      email: customer.email,
      vehicleCount: customer._count.vehicles,
      addressCount: customer._count.addresses,
      contactCount: customer._count.contacts,
      washesThisYear: washes.length,
      revenueYearCents: washes.reduce((sum, a) => sum + a.totalCents, 0),
      averageIntervalDays:
        washes.length >= 2 && first && last
          ? Math.round((last.getTime() - first.getTime()) / 86_400_000 / (washes.length - 1))
          : null,
      unpaidInvoices: customer.invoices.length,
      unpaidCents: customer.invoices.reduce((sum, i) => sum + i.totalCents, 0),
    };
  });
}
