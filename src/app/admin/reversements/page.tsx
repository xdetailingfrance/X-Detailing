import Link from "next/link";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { fortnightOf, prepareAllSettlements, previousFortnight } from "@/server/settlements";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, Segmented, StatRow, StatTile, Td, Th,
} from "@/components/ui";
import { EmitButton, PayoutButton } from "./panels";

export const metadata = { title: "Reversements · X Detailing OS" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "warn" | "ok" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  ISSUED: { label: "À virer", tone: "warn" },
  PAID: { label: "Viré", tone: "ok" },
};

async function currentPeriods() {
  const now = new Date();
  return { closed: previousFortnight(now), running: fortnightOf(now) };
}

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requireBackOffice();
  const { periode } = await searchParams;
  const { closed, running } = await currentPeriods();

  const period = periode === "courante" ? running : closed;

  const [drafts, history] = await Promise.all([
    prepareAllSettlements(period),
    prisma.settlement.findMany({
      orderBy: [{ periodStart: "desc" }, { reference: "asc" }],
      take: 30,
      include: { operator: { select: { firstName: true, lastName: true, code: true } } },
    }),
  ]);

  const payable = drafts.filter((d) => d.jobCount > 0);
  const totalPayout = payable.reduce((sum, d) => sum + d.payoutCents, 0);
  // Un opérateur qui a encaissé plus d'espèces qu'il n'a gagné net doit la différence
  // à X Detailing : le reversement change de sens, il ne devient pas nul.
  const owing = payable.filter((d) => d.payoutCents < 0);
  const totalCommission = payable.reduce((sum, d) => sum + d.commissionCents, 0);
  const totalCash = payable.reduce((sum, d) => sum + d.cashHeldCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reversements"
        lead="X Detailing encaisse l'ensemble des prestations et reverse aux indépendants à la quinzaine."
        actions={
          <Segmented
            items={[
              { key: "close", label: closed.label, href: "/admin/reversements", active: periode !== "courante" },
              { key: "courante", label: `${running.label} (en cours)`, href: "/admin/reversements?periode=courante", active: periode === "courante" },
            ]}
          />
        }
      />

      <StatRow>
        <StatTile label="Opérateurs à reverser" value={String(payable.length)} hint={period.label} />
        <StatTile label="Commissions X Detailing" value={formatEuros(totalCommission)} tone="positive" />
        <StatTile
          label="Espèces détenues"
          value={formatEuros(totalCash)}
          hint="déduites des virements"
          tone={totalCash > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label={totalPayout >= 0 ? "Total à virer" : "Solde net en votre faveur"}
          value={formatEuros(Math.abs(totalPayout))}
          hint={owing.length > 0 ? `${owing.length} opérateur(s) débiteur(s)` : undefined}
        />
      </StatRow>

      <Card
        title={`Quinzaine du ${period.label}`}
        action={
          periode === "courante" ? (
            <span className="text-xs text-xd-warn">quinzaine non close</span>
          ) : (
            <span className="text-xs text-ink-500">close, prête à virer</span>
          )
        }
      >
        {payable.length === 0 ? (
          <EmptyState>Aucune prestation terminée sur cette quinzaine.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Opérateur</Th>
                  <Th className="text-right">Prestations</Th>
                  <Th className="text-right">CA produit</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Publicité</Th>
                  <Th className="text-right">Espèces détenues</Th>
                  <Th className="text-right">Solde</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payable.map((draft) => (
                  <tr key={draft.operatorId} className="hover:bg-ink-50/60">
                    <Td>
                      <Link
                        href={`/admin/operateurs/${draft.operatorId}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {draft.operatorName}
                      </Link>
                      <p className="text-xs text-ink-400">{draft.operatorCode}</p>
                    </Td>
                    <Td className="tabular text-right">{draft.jobCount}</Td>
                    <Td className="tabular text-right font-medium">
                      {formatEuros(draft.totalRevenueCents)}
                    </Td>
                    <Td className="tabular text-right text-ink-500">
                      −{formatEuros(draft.commissionCents)}
                      <span className="ml-1 text-xs text-ink-400">
                        {(draft.commissionRate * 100).toFixed(0)} %
                      </span>
                    </Td>
                    <Td className="tabular text-right text-ink-500">
                      {draft.adContributionCents > 0
                        ? `−${formatEuros(draft.adContributionCents)}`
                        : "—"}
                    </Td>
                    <Td className="tabular text-right">
                      {draft.cashHeldCents > 0 ? (
                        <span className="text-xd-warn">−{formatEuros(draft.cashHeldCents)}</span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                    <Td className="tabular text-right">
                      {draft.payoutCents >= 0 ? (
                        <span className="text-base font-semibold text-ink-900">
                          {formatEuros(draft.payoutCents)}
                        </span>
                      ) : (
                        <>
                          <span className="text-base font-semibold text-xd-warn">
                            {formatEuros(Math.abs(draft.payoutCents))}
                          </span>
                          <p className="text-[11px] font-normal text-xd-warn">
                            dû par l&apos;opérateur
                          </p>
                        </>
                      )}
                    </Td>
                    <Td className="text-right">
                      {draft.existingId ? (
                        <Badge tone={STATUS[draft.existingStatus ?? "DRAFT"].tone}>
                          {STATUS[draft.existingStatus ?? "DRAFT"].label}
                        </Badge>
                      ) : (
                        <EmitButton
                          operatorId={draft.operatorId}
                          periodStart={draft.period.start.toISOString()}
                        />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          CA produit − commission − publicité = net gagné. Les espèces déjà perçues par
          l&apos;opérateur sont déduites puisqu&apos;il les détient déjà (§16, §18). Un
          opérateur qui encaisse surtout en espèces devient débiteur : c&apos;est alors lui
          qui doit la différence à X Detailing.
        </p>
      </Card>

      <Card title="Historique des reversements">
        {history.length === 0 ? (
          <EmptyState>Aucun reversement émis.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Référence</Th>
                  <Th>Opérateur</Th>
                  <Th>Quinzaine</Th>
                  <Th className="text-right">CA</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Viré</Th>
                  <Th>Statut</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {history.map((settlement) => {
                  const status = STATUS[settlement.status] ?? STATUS.DRAFT;
                  return (
                    <tr key={settlement.id}>
                      <Td className="tabular font-medium text-ink-900">{settlement.reference}</Td>
                      <Td className="text-ink-700">
                        {settlement.operator.firstName} {settlement.operator.lastName}
                      </Td>
                      <Td className="tabular text-ink-600">
                        {formatLocalDate(settlement.periodStart)} →{" "}
                        {formatLocalDate(new Date(settlement.periodEnd.getTime() - 86_400_000))}
                      </Td>
                      <Td className="tabular text-right">{formatEuros(settlement.totalRevenueCents)}</Td>
                      <Td className="tabular text-right text-ink-500">
                        {formatEuros(settlement.commissionCents)}
                      </Td>
                      <Td className="tabular text-right font-medium">
                        {settlement.payoutCents >= 0 ? (
                          formatEuros(settlement.payoutCents)
                        ) : (
                          <span className="text-xd-warn">
                            {formatEuros(Math.abs(settlement.payoutCents))} dû
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {settlement.paymentRef && (
                          <p className="mt-0.5 text-xs text-ink-400">{settlement.paymentRef}</p>
                        )}
                      </Td>
                      <Td className="text-right">
                        {settlement.status === "ISSUED" ? (
                          <PayoutButton settlementId={settlement.id} />
                        ) : settlement.paidAt ? (
                          <span className="text-xs text-ink-400">
                            {formatLocalDate(settlement.paidAt)}
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
    </div>
  );
}
