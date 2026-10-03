import Link from "next/link";
import { requireBackOffice } from "@/lib/auth/guard";
import { getOperatorStatistics, type Period } from "@/server/statistics";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate } from "@/server/time";
import {
  Badge, Card, PageHeader, Segmented, StatRow, StatTile, Td, Th,
} from "@/components/ui";

export const metadata = { title: "Statistiques · X Detailing OS" };
export const dynamic = "force-dynamic";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "trimestre", label: "Trimestre" },
];

/** §5 — lecture de l'indice de répartition, en français plutôt qu'en coefficient. */
function balanceVerdict(gini: number | null): { label: string; tone: "ok" | "warn" | "danger"; hint: string } {
  if (gini === null) {
    return { label: "Non mesurable", tone: "warn", hint: "il faut au moins deux opérateurs actifs" };
  }
  if (gini <= 0.15) {
    return { label: "Équilibrée", tone: "ok", hint: "les écarts de CA entre opérateurs restent faibles" };
  }
  if (gini <= 0.3) {
    return { label: "Acceptable", tone: "warn", hint: "des écarts existent, à surveiller" };
  }
  return {
    label: "Déséquilibrée",
    tone: "danger",
    hint: "le CA se concentre sur quelques opérateurs — vérifiez les poids du moteur",
  };
}

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requireBackOffice();
  const { periode } = await searchParams;

  const period: Period = PERIODS.some((p) => p.key === periode)
    ? (periode as Period)
    : "mois";

  const stats = await getOperatorStatistics(period);
  const verdict = balanceVerdict(stats.balance.gini);

  const maxRevenue = Math.max(1, ...stats.operators.map((o) => o.revenueCents));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistiques du réseau"
        lead={`Depuis le ${formatLocalDate(stats.start)}.`}
        actions={
          <Segmented
            items={PERIODS.map((p) => ({
              key: p.key,
              label: p.label,
              href: `/admin/statistiques?periode=${p.key}`,
              active: p.key === period,
            }))}
          />
        }
      />

      <StatRow>
        <StatTile label="CA réseau" value={formatEuros(stats.network.revenueCents)} hint={`${stats.network.jobs} prestations`} />
        <StatTile label="Commissions" value={formatEuros(stats.network.commissionCents)} tone="positive" />
        <StatTile
          label="Panier moyen"
          value={formatEuros(stats.network.jobs ? Math.round(stats.network.revenueCents / stats.network.jobs) : 0)}
        />
        <StatTile
          label="Annulations"
          value={String(stats.network.cancellations)}
          tone={stats.network.cancellations > 0 ? "warning" : "neutral"}
        />
      </StatRow>

      {/* ── §5 : la répartition est-elle juste ? ──────────────────────────── */}
      <Card title="Répartition du chiffre d'affaires" action={<Badge tone={verdict.tone}>{verdict.label}</Badge>}>
        <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <ul className="space-y-2.5">
              {stats.operators
                .filter((o) => o.status === "ACTIVE")
                .map((operator) => (
                  <li key={operator.id} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-sm text-ink-700">{operator.name}</span>
                    <span className="h-5 flex-1 overflow-hidden rounded bg-xd-graphite">
                      <span
                        className="block h-full rounded bg-brand-500"
                        style={{ width: `${Math.max(2, (operator.revenueCents / maxRevenue) * 100)}%` }}
                      />
                    </span>
                    <span className="tabular w-24 shrink-0 text-right text-sm font-medium text-ink-900">
                      {formatEuros(operator.revenueCents)}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <dl className="space-y-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Indice de répartition
              </dt>
              <dd className="tabular mt-0.5 text-2xl font-semibold text-ink-900">
                {stats.balance.gini === null ? "—" : stats.balance.gini.toFixed(2)}
              </dd>
              <dd className="mt-0.5 text-xs text-ink-500">{verdict.hint}</dd>
            </div>

            <div className="border-t border-ink-200 pt-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Écart entre extrêmes
              </dt>
              <dd className="tabular mt-0.5 text-sm font-medium text-ink-900">
                {formatEuros(stats.balance.spreadCents)}
              </dd>
            </div>

            <div className="border-t border-ink-200 pt-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">
                Propositions du moteur suivies
              </dt>
              <dd className="tabular mt-0.5 text-sm font-medium text-ink-900">
                {stats.balance.engineFollowRate === null
                  ? "—"
                  : `${stats.balance.engineFollowRate} %`}
                <span className="ml-2 font-normal text-xs text-ink-500">
                  sur {stats.balance.assignmentRuns} affectations
                </span>
              </dd>
              <dd className="mt-0.5 text-xs text-ink-500">
                {stats.balance.manualOverrides} choix manuels — un taux élevé signale un
                moteur mal réglé.
              </dd>
            </div>
          </dl>
        </div>

        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          0 = répartition parfaitement égale, 1 = tout le CA sur un seul opérateur. Sans
          unité, donc comparable d&apos;un mois à l&apos;autre (§5).
        </p>
      </Card>

      {/* ── §22 : le détail par opérateur ─────────────────────────────────── */}
      <Card title="Détail par opérateur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-ink-50">
              <tr>
                <Th>Opérateur</Th>
                <Th>Secteur</Th>
                <Th className="text-right">Prestations</Th>
                <Th className="text-right">CA</Th>
                <Th className="text-right">Panier</Th>
                <Th className="text-right">Remplissage</Th>
                <Th className="text-right">Trajet</Th>
                <Th className="text-right">Ponctualité</Th>
                <Th className="text-right">Avis</Th>
                <Th className="text-right">Annul.</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {stats.operators.map((operator) => (
                <tr key={operator.id} className="hover:bg-ink-50/60">
                  <Td>
                    <Link
                      href={`/admin/operateurs/${operator.id}`}
                      className="font-medium text-ink-900 hover:text-brand-600"
                    >
                      {operator.name}
                    </Link>
                    {operator.status !== "ACTIVE" && (
                      <span className="ml-2"><Badge tone="warn">inactif</Badge></span>
                    )}
                  </Td>
                  <Td className="text-ink-600">{operator.sector ?? "—"}</Td>
                  <Td className="tabular text-right">{operator.jobs}</Td>
                  <Td className="tabular text-right font-medium">{formatEuros(operator.revenueCents)}</Td>
                  <Td className="tabular text-right text-ink-500">{formatEuros(operator.averageBasketCents)}</Td>
                  <Td className="tabular text-right">
                    <span
                      className={
                        operator.fillRate >= 0.85
                          ? "text-xd-ok"
                          : operator.fillRate >= 0.5
                            ? "text-ink-700"
                            : "text-xd-warn"
                      }
                    >
                      {Math.round(operator.fillRate * 100)} %
                    </span>
                  </Td>
                  <Td className="tabular text-right text-ink-500">
                    {operator.travelMin} min
                    {operator.distanceKm > 0 && (
                      <span className="ml-1 text-xs text-ink-400">· {operator.distanceKm} km</span>
                    )}
                  </Td>
                  <Td className="tabular text-right">
                    {operator.punctuality === null ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <span className={operator.punctuality < 80 ? "text-xd-warn" : "text-ink-700"}>
                        {operator.punctuality} %
                      </span>
                    )}
                  </Td>
                  <Td className="tabular text-right">
                    {operator.averageRating === null ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <>
                        {operator.averageRating} ★
                        <span className="ml-1 text-xs text-ink-400">({operator.reviewCount})</span>
                        {operator.lowReviews > 0 && (
                          <span className="ml-1 text-xs text-xd-danger">{operator.lowReviews} faible{operator.lowReviews > 1 ? "s" : ""}</span>
                        )}
                      </>
                    )}
                  </Td>
                  <Td className="tabular text-right">
                    {operator.cancellations > 0 || operator.noShows > 0 ? (
                      <span className="text-xd-warn">
                        {operator.cancellations}
                        {operator.noShows > 0 && ` · ${operator.noShows} absent`}
                      </span>
                    ) : (
                      <span className="text-ink-400">0</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          Ponctualité : part des prestations démarrées dans les 10 minutes suivant
          l&apos;heure prévue. Remplissage : prestations réalisées rapportées à
          l&apos;objectif, sur les jours effectivement travaillés.
        </p>
      </Card>
    </div>
  );
}
