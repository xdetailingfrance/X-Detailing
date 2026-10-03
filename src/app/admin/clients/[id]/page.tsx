import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBackOffice } from "@/lib/auth/guard";
import { getCustomer } from "@/server/crm";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate, formatLocalDateTime } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatRow, StatTile, StatusBadge, Td, Th,
} from "@/components/ui";

export const metadata = { title: "Fiche client · X Detailing OS" };

const VEHICLE_LABEL: Record<string, string> = {
  CITADINE: "Citadine", BERLINE: "Berline", BREAK: "Break", SUV: "SUV",
  QUATRE_X_QUATRE: "4x4", UTILITAIRE: "Utilitaire", SEPT_PLACES: "7 places",
};

const SOURCE_LABEL: Record<string, string> = {
  WEB: "Site client", PHONE: "Téléphone", META_LEAD: "Lead Meta",
  WASH_NOW: "Laver maintenant", SLOT_RESALE: "Créneau revendu", RECURRING: "Récurrent",
};

/** §23 — fiche client complète, §24 — comptes professionnels et flottes. */
export default async function CustomerPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireBackOffice();
  const { id } = await params;

  const customer = await getCustomer(id);
  if (!customer) notFound();

  const name =
    customer.companyName ??
    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim();

  const now = new Date();
  const billable = customer.appointments.filter(
    (a) => !["CANCELLED", "NO_SHOW", "DRAFT"].includes(a.status),
  );
  const past = billable.filter((a) => a.scheduledStart <= now);
  const upcoming = billable.filter((a) => a.scheduledStart > now).reverse();
  const totalCents = billable.reduce((sum, a) => sum + a.totalCents, 0);
  const lastCompleted = past.find((a) => a.status === "COMPLETED") ?? past[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title={<>{name}</>}
        badges={<>{customer.type === "BUSINESS" && <Badge tone="accent">Compte entreprise</Badge>} {customer.flexible && <Badge tone="ok">Accepte les créneaux de dernière minute</Badge>} {!customer.marketingOptIn && <Badge tone="neutral">Refuse le démarchage</Badge>}</>}
        lead={<>{customer.phone} {customer.email && ` · ${customer.email}`} {customer.siret && ` · SIRET ${customer.siret}`}</>}
        actions={<><div className="flex flex-wrap gap-2"> {lastCompleted && ( <Link href={`/admin/rendez-vous/nouveau?client=${customer.id}&modele=${lastCompleted.id}`} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700" > Refaire la même prestation </Link> )} <Link href="/admin/clients" className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-ink-600 hover:bg-white/[0.09] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]" > ← Clients </Link> </div></>}
      />

      <StatRow>
        <StatTile label="Total dépensé" value={formatEuros(totalCents)} hint={`${billable.length} prestations`} />
        <StatTile
          label="Panier moyen"
          value={formatEuros(billable.length ? Math.round(totalCents / billable.length) : 0)}
        />
        <StatTile
          label="Dernier lavage"
          value={past[0] ? formatLocalDate(past[0].scheduledStart) : "—"}
          hint={past[0]?.service.name}
        />
        <StatTile
          label="Prochain RDV"
          value={upcoming[0] ? formatLocalDate(upcoming[0].scheduledStart) : "aucun"}
          tone={upcoming.length > 0 ? "positive" : "neutral"}
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`Historique (${customer.appointments.length})`}>
          {customer.appointments.length === 0 ? (
            <EmptyState>Aucun rendez-vous enregistré.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-ink-50">
                  <tr>
                    <Th>Date</Th>
                    <Th>Prestation</Th>
                    <Th>Opérateur</Th>
                    <Th>Origine</Th>
                    <Th>Statut</Th>
                    <Th className="text-right">Montant</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {customer.appointments.map((appointment) => (
                    <tr key={appointment.id} className="hover:bg-ink-50/60">
                      <Td>
                        <Link
                          href={`/admin/rendez-vous/${appointment.id}`}
                          className="font-medium text-ink-900 hover:text-brand-600"
                        >
                          {formatLocalDate(appointment.scheduledStart)}
                        </Link>
                        <p className="text-xs text-ink-400">{appointment.reference}</p>
                      </Td>
                      <Td className="text-ink-600">
                        {appointment.service.name}
                        {appointment.options.length > 0 && (
                          <span className="block text-xs text-ink-400">
                            + {appointment.options.map((o) => o.option.name).join(", ")}
                          </span>
                        )}
                      </Td>
                      <Td className="text-ink-600">
                        {appointment.operator
                          ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
                          : "—"}
                      </Td>
                      <Td className="text-xs text-ink-500">
                        {SOURCE_LABEL[appointment.source] ?? appointment.source}
                      </Td>
                      <Td><StatusBadge status={appointment.status} /></Td>
                      <Td className="tabular text-right font-medium">
                        {formatEuros(appointment.totalCents)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title={`Véhicules (${customer.vehicles.length})`}>
            {customer.vehicles.length === 0 ? (
              <EmptyState>Aucun véhicule enregistré.</EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-ink-800">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                        VEHICLE_LABEL[vehicle.vehicleClass]}
                    </p>
                    <p className="text-xs text-ink-500">
                      {VEHICLE_LABEL[vehicle.vehicleClass]}
                      {vehicle.plate && ` · ${vehicle.plate}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Adresses (${customer.addresses.length})`}>
            {customer.addresses.length === 0 ? (
              <EmptyState>Aucune adresse enregistrée.</EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="px-4 py-2.5">
                    <p className="text-sm text-ink-800">
                      {address.line1}, {address.postalCode} {address.city}
                      {address.isDefault && <span className="ml-2"><Badge tone="accent">par défaut</Badge></span>}
                    </p>
                    {address.accessNotes && (
                      <p className="mt-0.5 text-xs text-ink-500">{address.accessNotes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {customer.leads.length > 0 && (
            <Card title="Origine commerciale">
              <ul className="divide-y divide-ink-100">
                {customer.leads.map((lead) => (
                  <li key={lead.id} className="px-4 py-2.5">
                    <p className="text-sm text-ink-800">{lead.campaign ?? lead.source}</p>
                    <p className="text-xs text-ink-500">
                      {lead.source} · {formatLocalDate(lead.createdAt)}
                      {lead.costCents !== null && ` · coût ${formatEuros(lead.costCents)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Avis (${customer.reviews.length})`}>
            {customer.reviews.length === 0 ? (
              <EmptyState>Aucun avis déposé.</EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {customer.reviews.map((review) => (
                  <li key={review.id} className="px-4 py-2.5">
                    <p className="text-sm text-ink-800">
                      {"★".repeat(review.rating)}
                      <span className="text-ink-300">{"★".repeat(5 - review.rating)}</span>
                      <span className="ml-2 text-xs text-ink-500">
                        {review.operator.firstName} {review.operator.lastName}
                      </span>
                    </p>
                    {review.comment && <p className="mt-0.5 text-xs text-ink-600">{review.comment}</p>}
                    <p className="mt-0.5 text-xs text-ink-400">{formatLocalDateTime(review.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
