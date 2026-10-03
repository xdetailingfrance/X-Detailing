import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { previewInvoice } from "@/server/invoicing";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate, zonedParts } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatRow, StatTile, Td, Th,
} from "@/components/ui";
import { InvoicePanel, SettleInvoiceButton } from "./invoice-panel";

export const metadata = { title: "Compte entreprise · X Detailing OS" };
export const dynamic = "force-dynamic";

const VEHICLE_LABEL: Record<string, string> = {
  CITADINE: "Citadine", BERLINE: "Berline", BREAK: "Break", SUV: "SUV",
  QUATRE_X_QUATRE: "4x4", UTILITAIRE: "Utilitaire", SEPT_PLACES: "7 places",
};

const INVOICE_STATUS: Record<string, { label: string; tone: "neutral" | "warn" | "ok" | "danger" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  ISSUED: { label: "Émise", tone: "warn" },
  PAID: { label: "Réglée", tone: "ok" },
  CANCELLED: { label: "Annulée", tone: "danger" },
};

/** Le mois précédent : celui qu'on facture en pratique. */
async function billingPeriod(): Promise<{ year: number; month: number }> {
  const previous = new Date(Date.now() - 15 * 24 * 3600_000);
  const { year, month } = zonedParts(previous);
  return { year, month };
}

export default async function FleetAccountPage({ params }: PageProps<"/admin/entreprises/[id]">) {
  await requireBackOffice();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { billing: "desc" } },
      addresses: { orderBy: { isDefault: "desc" } },
      vehicles: { orderBy: { createdAt: "asc" } },
      invoices: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], include: { _count: { select: { lines: true } } } },
      appointments: {
        where: { status: "COMPLETED" },
        orderBy: { scheduledStart: "desc" },
        take: 10,
        include: {
          service: { select: { name: true } },
          customerVehicle: { select: { make: true, model: true, plate: true } },
        },
      },
    },
  });

  if (!customer) notFound();

  const period = await billingPeriod();
  const preview = await previewInvoice(customer.id, period.year, period.month);

  const name = customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim();
  const lifetimeCents = customer.appointments.reduce((sum, a) => sum + a.totalCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={<>{name}</>}
        badges={<><Badge tone="accent">Compte entreprise</Badge></>}
        lead={<>{customer.phone} {customer.email && ` · ${customer.email}`} {customer.siret && ` · SIRET ${customer.siret}`}</>}
        actions={<><div className="flex gap-2"> <Link href={`/admin/clients/${customer.id}`} className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-ink-600 hover:bg-white/[0.09] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]" > Fiche CRM </Link> <Link href="/admin/entreprises" className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-ink-600 hover:bg-white/[0.09] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]" > ← Comptes </Link> </div></>}
      />

      <StatRow>
        <StatTile label="Véhicules" value={String(customer.vehicles.length)} />
        <StatTile label="Sites d'intervention" value={String(customer.addresses.length)} />
        <StatTile label="Responsables" value={String(customer.contacts.length)} />
        <StatTile
          label="10 derniers lavages"
          value={formatEuros(lifetimeCents)}
          tone="positive"
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {preview && (
            <InvoicePanel
              customerId={customer.id}
              preview={{
                periodYear: preview.periodYear,
                periodMonth: preview.periodMonth,
                lines: preview.lines,
                subtotalCents: preview.subtotalCents,
                vatRate: preview.vatRate,
                vatCents: preview.vatCents,
                totalCents: preview.totalCents,
                existingInvoiceId: preview.existingInvoiceId,
              }}
            />
          )}

          <Card title={`Factures (${customer.invoices.length})`}>
            {customer.invoices.length === 0 ? (
              <EmptyState>Aucune facture émise.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead className="bg-ink-50">
                    <tr>
                      <Th>Numéro</Th>
                      <Th>Période</Th>
                      <Th className="text-right">Lignes</Th>
                      <Th className="text-right">HT</Th>
                      <Th className="text-right">TTC</Th>
                      <Th>Statut</Th>
                      <Th className="text-right">Action</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {customer.invoices.map((invoice) => {
                      const status = INVOICE_STATUS[invoice.status];
                      return (
                        <tr key={invoice.id}>
                          <Td className="tabular font-medium text-ink-900">{invoice.number}</Td>
                          <Td className="tabular text-ink-600">
                            {String(invoice.periodMonth).padStart(2, "0")}/{invoice.periodYear}
                          </Td>
                          <Td className="tabular text-right text-ink-500">{invoice._count.lines}</Td>
                          <Td className="tabular text-right">{formatEuros(invoice.subtotalCents)}</Td>
                          <Td className="tabular text-right font-medium">{formatEuros(invoice.totalCents)}</Td>
                          <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                          <Td className="text-right">
                            {invoice.status === "ISSUED" ? (
                              <SettleInvoiceButton
                                invoiceId={invoice.id}
                                customerId={customer.id}
                              />
                            ) : invoice.paidAt ? (
                              <span className="text-xs text-ink-400">
                                {formatLocalDate(invoice.paidAt)}
                              </span>
                            ) : (
                              <span className="text-xs text-ink-400">—</span>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Derniers lavages">
            {customer.appointments.length === 0 ? (
              <EmptyState>Aucune prestation terminée.</EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.appointments.map((appointment) => {
                  const vehicle = appointment.customerVehicle;
                  return (
                    <li key={appointment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                      <span className="tabular w-28 shrink-0 text-ink-500">
                        {formatLocalDate(appointment.scheduledStart)}
                      </span>
                      <Link
                        href={`/admin/rendez-vous/${appointment.id}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {appointment.reference}
                      </Link>
                      <span className="text-ink-600">
                        {appointment.service.name}
                        {vehicle && ` · ${[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" ")}`}
                      </span>
                      <span className="tabular ml-auto font-medium text-ink-700">
                        {formatEuros(appointment.totalCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={`Flotte (${customer.vehicles.length})`}>
            {customer.vehicles.length === 0 ? (
              <EmptyState>Aucun véhicule enregistré.</EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="px-4 py-2.5">
                    <Link
                      href={`/admin/vehicules/${vehicle.id}`}
                      className="text-sm font-medium text-ink-800 hover:text-brand-600"
                    >
                      {[vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                        VEHICLE_LABEL[vehicle.vehicleClass]}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {VEHICLE_LABEL[vehicle.vehicleClass]}
                      {vehicle.plate && ` · ${vehicle.plate}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Responsables (${customer.contacts.length})`}>
            {customer.contacts.length === 0 ? (
              <EmptyState>
                Aucun responsable enregistré — les factures partent sur le contact
                principal du compte.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.contacts.map((contact) => (
                  <li key={contact.id} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-ink-800">
                      {contact.firstName} {contact.lastName}
                      {contact.billing && (
                        <span className="ml-2"><Badge tone="accent">facturation</Badge></span>
                      )}
                    </p>
                    <p className="text-xs text-ink-500">
                      {contact.role ?? "—"}
                      {contact.email && ` · ${contact.email}`}
                      {contact.phone && ` · ${contact.phone}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Sites (${customer.addresses.length})`}>
            <ul className="divide-y divide-ink-100">
              {customer.addresses.map((address) => (
                <li key={address.id} className="px-4 py-2.5">
                  <p className="text-sm text-ink-800">
                    {address.line1}, {address.postalCode} {address.city}
                    {address.isDefault && <span className="ml-2"><Badge tone="accent">siège</Badge></span>}
                  </p>
                  {address.accessNotes && (
                    <p className="mt-0.5 text-xs text-ink-500">{address.accessNotes}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
