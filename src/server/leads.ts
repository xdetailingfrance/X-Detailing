import { prisma } from "./db";
import { startOfLocalMonth } from "./time";

/**
 * Acquisition (§19).
 *
 * « Le CRM doit rattacher chaque rendez-vous au lead/source afin de mesurer coût par
 * lead, conversion et CA généré. » Les trois chiffres sont donc calculés ensemble : un
 * coût par lead sans le CA qu'il a produit ne dit rien.
 */

const BILLABLE = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

export async function getLeadBoard(now = new Date()) {
  const monthStart = startOfLocalMonth(now);

  const [leads, monthLeads, monthRevenue] = await Promise.all([
    prisma.lead.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        appointments: {
          select: { id: true, reference: true, totalCents: true, status: true, scheduledStart: true },
          orderBy: { scheduledStart: "asc" },
        },
      },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: monthStart } },
      select: { id: true, costCents: true, status: true, campaign: true, source: true },
    }),
    prisma.appointment.findMany({
      where: {
        leadId: { not: null },
        scheduledStart: { gte: monthStart },
        status: { in: [...BILLABLE] },
      },
      select: { leadId: true, totalCents: true },
    }),
  ]);

  const spentCents = monthLeads.reduce((sum, lead) => sum + (lead.costCents ?? 0), 0);
  const bookedCount = monthLeads.filter((lead) => lead.status === "BOOKED").length;
  const revenueCents = monthRevenue.reduce((sum, a) => sum + a.totalCents, 0);

  // Regroupement par campagne : c'est à ce niveau que la décision publicitaire se prend,
  // pas au niveau du lead individuel.
  const byCampaign = new Map<string, { leads: number; booked: number; costCents: number; revenueCents: number }>();
  const revenueByLead = new Map<string, number>();
  for (const row of monthRevenue) {
    if (row.leadId) revenueByLead.set(row.leadId, (revenueByLead.get(row.leadId) ?? 0) + row.totalCents);
  }

  for (const lead of monthLeads) {
    const key = lead.campaign ?? `Sans campagne (${lead.source})`;
    const entry = byCampaign.get(key) ?? { leads: 0, booked: 0, costCents: 0, revenueCents: 0 };
    entry.leads += 1;
    if (lead.status === "BOOKED") entry.booked += 1;
    entry.costCents += lead.costCents ?? 0;
    entry.revenueCents += revenueByLead.get(lead.id) ?? 0;
    byCampaign.set(key, entry);
  }

  return {
    leads,
    month: {
      count: monthLeads.length,
      bookedCount,
      spentCents,
      revenueCents,
      costPerLeadCents: monthLeads.length ? Math.round(spentCents / monthLeads.length) : 0,
      costPerBookingCents: bookedCount ? Math.round(spentCents / bookedCount) : 0,
      conversionRate: monthLeads.length ? bookedCount / monthLeads.length : 0,
    },
    campaigns: [...byCampaign.entries()]
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenueCents - a.revenueCents),
  };
}
