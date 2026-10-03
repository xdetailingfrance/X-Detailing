import Link from "next/link";
import { getDashboard, type Period } from "@/server/dashboard";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate } from "@/server/time";
import {
  Badge, EmptyState, Footnote, LoadDot, MetricBar, PageHeader, Panel, Segmented, StatusPill, Table, Td, Th, Tr,
} from "@/components/ui";

export const metadata = { title: "Tableau de bord · X Detailing OS" };
export const dynamic = "force-dynamic";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "jour", label: "Jour" },
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
];

/**
 * §26 — « ne pas mettre chaque métrique dans une énorme card ».
 *
 * L'écran s'organise en trois temps : ce que le réseau a produit, ce qui se passe
 * maintenant, et qui fait quoi. Chaque groupe est une surface, pas une grille de boîtes
 * identiques : c'est la hiérarchie typographique qui dit où regarder.
 */

const FIELD_STATES = [
  { status: "CONFIRMED", label: "À venir" },
  { status: "EN_ROUTE", label: "En trajet" },
  { status: "ARRIVED", label: "Arrivés" },
  { status: "IN_PROGRESS", label: "En cours" },
  { status: "PAYMENT", label: "Encaissement" },
  { status: "COMPLETED", label: "Terminés" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode } = await searchParams;
  const period: Period = PERIODS.some((p) => p.key === periode) ? (periode as Period) : "jour";
  const data = await getDashboard(period);

  const rangeLabel =
    period === "jour"
      ? formatLocalDate(data.range.start)
      : `${formatLocalDate(data.range.start)} → ${formatLocalDate(new Date(data.range.end.getTime() - 1))}`;

  const live = FIELD_STATES.map((state) => ({ ...state, count: data.live[state.status] ?? 0 }));
  const onField = live.filter((s) => !["CONFIRMED", "COMPLETED"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-7">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <PageHeader
        title="Tableau de bord"
        lead={<span className="first-letter:uppercase">{rangeLabel}</span>}
        actions={
          <Segmented
            items={PERIODS.map((p) => ({
              key: p.key,
              label: p.label,
              href: `/admin?periode=${p.key}`,
              active: p.key === period,
            }))}
          />
        }
      />

      {/* ── Ce que le réseau a produit ─────────────────────────────────── */}
      <MetricBar
        metrics={[
          {
            label: "Chiffre d'affaires",
            value: formatEuros(data.network.revenueCents),
            hint: `${data.network.jobsCount} prestation${data.network.jobsCount > 1 ? "s" : ""}`,
          },
          {
            label: "Commission 18 %",
            value: formatEuros(data.network.commissionCents),
            hint: "hors publicité",
            tone: "ok",
          },
          {
            label: "Panier moyen",
            value: formatEuros(data.network.averageBasketCents),
          },
          {
            label: "Annulations",
            value: String(data.network.cancelledCount),
            hint: data.network.cancelledCount > 0 ? "créneaux remis en jeu" : "aucune",
            tone: data.network.cancelledCount > 0 ? "warn" : "neutral",
          },
        ]}
      />

      {/* ── Ce qui se passe maintenant ─────────────────────────────────── */}
      <Panel
        title="Sur le terrain"
        action={
          <Link
            href="/admin/carte"
            className="text-meta text-xd-purple-bright transition-opacity hover:opacity-75"
          >
            Voir la carte
          </Link>
        }
      >
        <div className="grid grid-cols-3 lg:grid-cols-6">
          {live.map((state, index) => (
            <div
              key={state.status}
              className={`px-5 py-4 ${index % 3 !== 0 ? "[box-shadow:inset_1px_0_0_0_var(--xd-hairline)]" : ""} ${index >= 3 ? "hairline-t lg:[box-shadow:inset_1px_0_0_0_var(--xd-hairline)]" : ""}`}
            >
              <p className="eyebrow text-xd-text-4">{state.label}</p>
              <p
                className={`tabular mt-1.5 text-3xl font-semibold leading-none tracking-[-0.03em] ${
                  state.count === 0 ? "text-xd-text-4" : "text-xd-text"
                }`}
              >
                {state.count}
              </p>
            </div>
          ))}
        </div>
        <Footnote>
          {onField > 0
            ? `${onField} opérateur${onField > 1 ? "s" : ""} en intervention en ce moment.`
            : "Aucune intervention en cours."}
        </Footnote>
      </Panel>

      {/* ── Qui fait quoi ──────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Panel title="Répartition par opérateur" action={<span className="text-meta text-xd-text-4">CA {period}</span>}>
          <Table minWidth={780}>
            <thead>
              <tr>
                <Th className="min-w-44">Opérateur</Th>
                <Th className="text-center">Charge</Th>
                <Th className="text-right">RDV</Th>
                <Th className="whitespace-nowrap text-right">Chiffre d&apos;affaires</Th>
                <Th className="text-right">Commission</Th>
                <Th className="text-right">Qualité</Th>
              </tr>
            </thead>
            <tbody>
              {data.operators.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link
                      href={`/admin/operateurs/${row.id}`}
                      className="whitespace-nowrap font-medium text-xd-text transition-colors hover:text-xd-purple-bright"
                    >
                      {row.name}
                    </Link>
                    <span className="ml-2 whitespace-nowrap text-meta text-xd-text-4">{row.code}</span>
                    {row.status !== "ACTIVE" && (
                      <span className="ml-2">
                        <Badge tone="warn">
                          {row.status === "SUSPENDED" ? "suspendu" : "intégration"}
                        </Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="text-center">
                    <span className="inline-flex items-center gap-2">
                      <LoadDot level={row.loadLevel} />
                      <span className="tabular text-meta text-xd-text-3">
                        {row.jobsToday}/{row.targetJobsPerDay}
                      </span>
                    </span>
                  </Td>
                  <Td className="tabular text-right">{row.jobsInPeriod}</Td>
                  <Td className="tabular text-right font-medium text-xd-text">
                    {formatEuros(row.revenuePeriodCents)}
                  </Td>
                  <Td className="tabular text-right text-xd-text-3">
                    {formatEuros(row.commissionPeriodCents)}
                  </Td>
                  <Td className="tabular text-right">{row.qualityScore}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Footnote>
            L&apos;indicateur de charge alimente directement l&apos;axe « charge de travail »
            du moteur d&apos;affectation.
          </Footnote>
        </Panel>

        <div className="space-y-6">
          <Panel title="Encaissements">
            <dl>
              {[
                ["Paiements carte", formatEuros(data.payments.cardCents)],
                ["Espèces détenues", formatEuros(data.payments.cashCents)],
                ["En attente", formatEuros(data.payments.unpaidCents)],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`flex items-baseline justify-between px-5 py-3 ${index > 0 ? "hairline-t" : ""}`}
                >
                  <dt className="text-body text-xd-text-3">{label}</dt>
                  <dd className="tabular text-body font-medium text-xd-text">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel
            title="Alertes"
            action={
              data.alerts.length > 0 ? (
                <span className="tabular text-meta text-xd-text-4">{data.alerts.length}</span>
              ) : null
            }
          >
            {data.alerts.length === 0 ? (
              <EmptyState>Rien ne demande votre attention.</EmptyState>
            ) : (
              <ul>
                {data.alerts.map((alert, index) => (
                  <li key={alert.id} className={`px-5 py-3.5 ${index > 0 ? "hairline-t" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-body font-medium text-xd-text">{alert.title}</p>
                      <StatusPill tone={alert.severity === "CRITICAL" ? "danger" : "warn"}>
                        {alert.severity === "CRITICAL" ? "critique" : "à traiter"}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-meta leading-relaxed text-xd-text-3">{alert.message}</p>
                    {alert.operator && (
                      <p className="mt-1.5 text-meta text-xd-text-4">
                        {alert.operator.firstName} {alert.operator.lastName} · {alert.operator.code}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
