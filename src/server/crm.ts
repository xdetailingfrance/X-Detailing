import { prisma } from "./db";

/**
 * CRM client (§23) et comptes professionnels (§24).
 *
 * Le CRM sert deux usages qui n'ont pas les mêmes besoins : le conseiller qui cherche un
 * appelant par téléphone en pleine conversation, et le patron qui veut savoir qui relancer.
 * Les deux requêtes sont donc séparées plutôt que filtrées depuis une liste unique.
 */

const BILLABLE = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

export type CustomerRow = {
  id: string;
  type: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
  vehicleCount: number;
  appointmentCount: number;
  totalSpentCents: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
  flexible: boolean;
};

export async function listCustomers(options: { query?: string; take?: number } = {}) {
  const query = options.query?.trim();

  // Le conseiller tape un numéro de téléphone pendant que le client parle : la recherche
  // doit tolérer les espaces et les points de la saisie réelle.
  const digits = query?.replace(/[^\d]/g, "") ?? "";

  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { companyName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: options.take ?? 60,
    include: {
      addresses: { where: { isDefault: true }, take: 1, select: { city: true } },
      _count: { select: { vehicles: true } },
      appointments: {
        where: { status: { in: [...BILLABLE] } },
        select: { scheduledStart: true, totalCents: true, status: true },
        orderBy: { scheduledStart: "desc" },
      },
    },
  });

  const now = new Date();

  return customers.map((customer): CustomerRow => {
    const past = customer.appointments.filter((a) => a.scheduledStart <= now);
    const future = customer.appointments.filter((a) => a.scheduledStart > now);

    return {
      id: customer.id,
      type: customer.type,
      name:
        customer.companyName ??
        `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ??
        "Client",
      phone: customer.phone,
      email: customer.email,
      city: customer.addresses[0]?.city ?? null,
      vehicleCount: customer._count.vehicles,
      appointmentCount: customer.appointments.length,
      totalSpentCents: customer.appointments.reduce((sum, a) => sum + a.totalCents, 0),
      lastVisit: past[0]?.scheduledStart ?? null,
      nextVisit: future.at(-1)?.scheduledStart ?? null,
      flexible: customer.flexible,
    };
  });
}

export async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      vehicles: { orderBy: { createdAt: "asc" } },
      leads: { orderBy: { createdAt: "desc" } },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: { operator: { select: { firstName: true, lastName: true } } },
      },
      appointments: {
        orderBy: { scheduledStart: "desc" },
        include: {
          service: { select: { name: true } },
          operator: { select: { firstName: true, lastName: true } },
          options: { include: { option: { select: { name: true } } } },
          photos: { select: { id: true, phase: true } },
        },
      },
    },
  });
}

export type FollowUpRow = {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  lastVisit: Date;
  daysSince: number;
  lastServiceName: string;
  lastTotalCents: number;
  vehicleLabel: string;
  marketingOptIn: boolean;
};

/**
 * §23 — « relance automatique après une période définie pour proposer un nouveau lavage ».
 *
 * Un client qui a déjà un rendez-vous à venir n'est jamais relancé : c'est l'erreur qui
 * fait passer une relance pour du spam.
 */
export async function customersDueForFollowUp(afterDays = 60): Promise<FollowUpRow[]> {
  const threshold = new Date(Date.now() - afterDays * 24 * 3600_000);
  const now = new Date();

  const customers = await prisma.customer.findMany({
    where: {
      appointments: {
        some: { status: "COMPLETED", scheduledStart: { lte: threshold } },
        none: { scheduledStart: { gt: now }, status: { in: [...BILLABLE] } },
      },
    },
    include: {
      appointments: {
        where: { status: "COMPLETED" },
        orderBy: { scheduledStart: "desc" },
        take: 1,
        include: {
          service: { select: { name: true } },
          customerVehicle: { select: { make: true, model: true, vehicleClass: true } },
        },
      },
    },
  });

  return customers
    .map((customer): FollowUpRow | null => {
      const last = customer.appointments[0];
      if (!last) return null;

      const vehicle = last.customerVehicle;
      return {
        customerId: customer.id,
        name:
          customer.companyName ??
          `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
        phone: customer.phone,
        email: customer.email,
        lastVisit: last.scheduledStart,
        daysSince: Math.floor((now.getTime() - last.scheduledStart.getTime()) / 86_400_000),
        lastServiceName: last.service.name,
        lastTotalCents: last.totalCents,
        vehicleLabel: vehicle
          ? [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
            vehicle.vehicleClass.replace(/_/g, " ").toLowerCase()
          : "—",
        marketingOptIn: customer.marketingOptIn,
      };
    })
    .filter((row): row is FollowUpRow => row !== null)
    .sort((a, b) => b.daysSince - a.daysSince);
}
