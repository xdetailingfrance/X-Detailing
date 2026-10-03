import Link from "next/link";
import { requireBackOffice } from "@/lib/auth/guard";
import { getLeadBoard } from "@/server/leads";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatRow, StatTile, Td, Th,
} from "@/components/ui";
import { LeadActions } from "./lead-actions";

export const metadata = { title: "Leads · X Detailing OS" };

const STATUS: Record<string, { label: string; tone: "warn" | "accent" | "ok" | "neutral" }> = {
  NEW: { label: "À rappeler", tone: "warn" },
  CONTACTED: { label: "Contacté", tone: "accent" },
  BOOKED: { label: "Converti", tone: "ok" },
  LOST: { label: "Perdu", tone: "neutral" },
};

export default async function LeadsPage() {
  await requireBackOffice();
  const board = await getLeadBoard();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads et acquisition"
        lead="Chaque rendez-vous est rattaché à sa source : coût par lead, conversion et CA généré se lisent ensemble."
      />

      <StatRow>
        <StatTile
          label="Leads du mois"
          value={String(board.month.count)}
          hint={`${board.month.bookedCount} convertis · ${Math.round(board.month.conversionRate * 100)} %`}
        />
        <StatTile label="Coût par lead" value={formatEuros(board.month.costPerLeadCents)} />
        <StatTile
          label="Coût par RDV obtenu"
          value={formatEuros(board.month.costPerBookingCents)}
          tone={
            board.month.costPerBookingCents > 0 &&
            board.month.revenueCents / Math.max(1, board.month.bookedCount) <
              board.month.costPerBookingCents * 2
              ? "warning"
              : "neutral"
          }
        />
        <StatTile
          label="CA généré"
          value={formatEuros(board.month.revenueCents)}
          hint={`pour ${formatEuros(board.month.spentCents)} investis`}
          tone="positive"
        />
      </StatRow>

      {board.campaigns.length > 0 && (
        <Card title="Par campagne (mois en cours)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Campagne</Th>
                  <Th className="text-right">Leads</Th>
                  <Th className="text-right">Convertis</Th>
                  <Th className="text-right">Dépense</Th>
                  <Th className="text-right">CA généré</Th>
                  <Th className="text-right">Retour</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {board.campaigns.map((campaign) => {
                  const ratio = campaign.costCents > 0 ? campaign.revenueCents / campaign.costCents : null;
                  return (
                    <tr key={campaign.name}>
                      <Td className="font-medium text-ink-800">{campaign.name}</Td>
                      <Td className="tabular text-right">{campaign.leads}</Td>
                      <Td className="tabular text-right">{campaign.booked}</Td>
                      <Td className="tabular text-right text-ink-500">{formatEuros(campaign.costCents)}</Td>
                      <Td className="tabular text-right font-medium">{formatEuros(campaign.revenueCents)}</Td>
                      <Td className="tabular text-right">
                        {ratio === null ? (
                          "—"
                        ) : (
                          <span className={ratio >= 3 ? "text-xd-ok" : ratio >= 1 ? "text-ink-700" : "text-xd-danger"}>
                            ×{ratio.toFixed(1)}
                          </span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
            La contribution publicitaire de chaque indépendant est plafonnée à 150 €/mois ;
            au-delà, X Detailing prend en charge le surplus (§19).
          </p>
        </Card>
      )}

      <Card title="Leads reçus">
        {board.leads.length === 0 ? (
          <EmptyState>
            Aucun lead. Les leads Meta arrivent sur <code>/api/webhooks/meta</code>.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Prospect</Th>
                  <Th>Campagne</Th>
                  <Th>Reçu</Th>
                  <Th className="text-right">Coût</Th>
                  <Th>Statut</Th>
                  <Th>Rendez-vous</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {board.leads.map((lead) => {
                  const status = STATUS[lead.status];
                  const appointment = lead.appointments[0];
                  return (
                    <tr key={lead.id} className="hover:bg-ink-50/60">
                      <Td>
                        <span className="font-medium text-ink-900">{lead.fullName ?? "Sans nom"}</span>
                        <p className="text-xs text-ink-400">
                          {lead.phone ?? lead.email ?? "—"}
                          {lead.city && ` · ${lead.city}`}
                        </p>
                      </Td>
                      <Td className="text-ink-600">
                        {lead.campaign ?? "—"}
                        {lead.adset && <span className="block text-xs text-ink-400">{lead.adset}</span>}
                      </Td>
                      <Td className="text-ink-600">{formatLocalDate(lead.createdAt)}</Td>
                      <Td className="tabular text-right text-ink-500">
                        {lead.costCents !== null ? formatEuros(lead.costCents) : "—"}
                      </Td>
                      <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                      <Td>
                        {appointment ? (
                          <Link
                            href={`/admin/rendez-vous/${appointment.id}`}
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            {appointment.reference}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-400">—</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <LeadActions
                          leadId={lead.id}
                          status={lead.status}
                          bookingHref={`/admin/rendez-vous/nouveau?lead=${lead.id}`}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
