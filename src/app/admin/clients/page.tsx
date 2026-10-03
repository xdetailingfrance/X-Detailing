import { Button, Input } from "@/components/controls";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { listCustomers, customersDueForFollowUp } from "@/server/crm";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, Td, Th,
} from "@/components/ui";
import { FOLLOW_UP_TEMPLATE } from "@/server/notification-templates";
import { FollowUpButton } from "./follow-up-button";

export const metadata = { title: "Clients · X Detailing OS" };

/** Une relance récente interdit d'en renvoyer une : c'est ce qui sépare un rappel du spam. */
const RELANCE_COOLDOWN_DAYS = 30;

/** Hors du corps de rendu : l'heure courante n'est pas une valeur pure. */
async function relanceCutoff(): Promise<Date> {
  return new Date(Date.now() - RELANCE_COOLDOWN_DAYS * 24 * 3600_000);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireBackOffice();
  const { q } = await searchParams;

  const [customers, followUps, recentRelances] = await Promise.all([
    listCustomers({ query: q }),
    customersDueForFollowUp(60),
    prisma.notification.findMany({
      where: {
        template: FOLLOW_UP_TEMPLATE,
        createdAt: { gte: await relanceCutoff() },
      },
      select: { recipient: true },
    }),
  ]);

  const contacted = new Set(recentRelances.map((n) => n.recipient));
  const pending = followUps.filter(
    (row) => !contacted.has(row.email ?? row.phone),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        lead="Historique, véhicules et dépense de chaque foyer ou entreprise du fichier."
        actions={
          <form className="flex gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Nom, 06…, e-mail" className="w-56" />
            <Button type="submit" variant="secondary">Chercher</Button>
          </form>
        }
      />

      {pending.length > 0 && !q && (
        <Card
          title={`À relancer (${pending.length})`}
          action={<span className="text-xs text-ink-500">sans lavage depuis 60 jours</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Client</Th>
                  <Th>Dernier lavage</Th>
                  <Th>Véhicule</Th>
                  <Th className="text-right">Dernier montant</Th>
                  <Th className="text-right">Relance</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pending.slice(0, 8).map((row) => (
                  <tr key={row.customerId} className="hover:bg-ink-50/60">
                    <Td>
                      <Link
                        href={`/admin/clients/${row.customerId}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs text-ink-400">{row.phone}</p>
                    </Td>
                    <Td className="text-ink-600">
                      {formatLocalDate(row.lastVisit)}
                      <span className="ml-2 text-xs text-ink-400">il y a {row.daysSince} j</span>
                    </Td>
                    <Td className="text-ink-600">{row.vehicleLabel}</Td>
                    <Td className="tabular text-right">{formatEuros(row.lastTotalCents)}</Td>
                    <Td className="text-right">
                      {row.marketingOptIn ? (
                        <FollowUpButton customerId={row.customerId} />
                      ) : (
                        <span className="text-xs text-ink-400">refuse le démarchage</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Fiches clients">
        {customers.length === 0 ? (
          <EmptyState>Aucun client ne correspond à cette recherche.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Client</Th>
                  <Th>Ville</Th>
                  <Th className="text-right">Véhicules</Th>
                  <Th className="text-right">Prestations</Th>
                  <Th className="text-right">Total dépensé</Th>
                  <Th>Dernier lavage</Th>
                  <Th>Prochain RDV</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-ink-50/60">
                    <Td>
                      <Link
                        href={`/admin/clients/${customer.id}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {customer.name}
                      </Link>
                      {customer.type === "BUSINESS" && (
                        <span className="ml-2"><Badge tone="accent">entreprise</Badge></span>
                      )}
                      {customer.flexible && (
                        <span className="ml-2"><Badge tone="ok">flexible</Badge></span>
                      )}
                      <p className="text-xs text-ink-400">{customer.phone}</p>
                    </Td>
                    <Td className="text-ink-600">{customer.city ?? "—"}</Td>
                    <Td className="tabular text-right">{customer.vehicleCount}</Td>
                    <Td className="tabular text-right">{customer.appointmentCount}</Td>
                    <Td className="tabular text-right font-medium">
                      {formatEuros(customer.totalSpentCents)}
                    </Td>
                    <Td className="text-ink-600">
                      {customer.lastVisit ? formatLocalDate(customer.lastVisit) : "—"}
                    </Td>
                    <Td className="text-ink-600">
                      {customer.nextVisit ? formatLocalDate(customer.nextVisit) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
