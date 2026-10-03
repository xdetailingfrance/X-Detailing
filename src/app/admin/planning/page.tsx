import { buttonClass } from "@/components/button-style";
import Link from "next/link";
import { getDayPlanning } from "@/server/planning";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate, formatLocalTime, toLocalDateInput, zonedParts } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatusBadge,
} from "@/components/ui";

export const metadata = { title: "Planning · X Detailing OS" };

/** Fenêtre affichée : 7h → 20h, soit la plage d'activité réaliste du réseau. */
const DAY_START_MIN = 7 * 60;
const DAY_END_MIN = 20 * 60;
const SPAN = DAY_END_MIN - DAY_START_MIN;

const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => 7 + i);

function position(date: Date) {
  const { minutes } = zonedParts(date);
  return ((minutes - DAY_START_MIN) / SPAN) * 100;
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const day = date ? new Date(`${date}T12:00:00Z`) : new Date();
  const planning = await getDayPlanning(day);

  const shift = (days: number) =>
    `/admin/planning?date=${toLocalDateInput(new Date(planning.dayStart.getTime() + days * 24 * 3600_000 + 12 * 3600_000))}`;

  const totalJobs = planning.operators.reduce((s, o) => s + o.jobs.length, 0);
  const totalConflicts = planning.operators.reduce((s, o) => s + o.conflicts, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Planning du réseau"
        lead={
          <>
            <span className="first-letter:uppercase">{formatLocalDate(planning.dayStart)}</span> ·{" "}
            {totalJobs} rendez-vous
            {totalConflicts > 0 && (
              <span className="ml-2 text-xd-danger">
                · {totalConflicts} tournée{totalConflicts > 1 ? "s" : ""} en conflit
              </span>
            )}
          </>
        }
        actions={
          <>
            <Link href={shift(-1)} className={buttonClass("secondary")}>← Veille</Link>
            <Link href="/admin/planning" className={buttonClass("secondary")}>Aujourd&apos;hui</Link>
            <Link href={shift(1)} className={buttonClass("secondary")}>Lendemain →</Link>
          </>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="flex border-b border-ink-100 bg-ink-50">
              <div className="w-52 shrink-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Opérateur
              </div>
              <div className="relative flex-1">
                {HOURS.map((hour) => (
                  <span
                    key={hour}
                    className="tabular absolute -translate-x-1/2 py-2 text-[11px] text-ink-400"
                    style={{ left: `${((hour * 60 - DAY_START_MIN) / SPAN) * 100}%` }}
                  >
                    {String(hour).padStart(2, "0")}h
                  </span>
                ))}
                <div className="h-8" />
              </div>
            </div>

            {planning.operators.map((operator) => (
              <div key={operator.id} className="flex border-b border-ink-100 last:border-b-0">
                <div className="w-52 shrink-0 px-4 py-3">
                  <Link href={`/admin/operateurs/${operator.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-600">
                    {operator.name}
                  </Link>
                  <p className="tabular text-xs text-ink-500">
                    {operator.jobs.length} RDV · {formatEuros(operator.revenueCents)}
                  </p>
                  {operator.status !== "ACTIVE" && (
                    <span className="mt-1 inline-block">
                      <Badge tone="warn">{operator.status === "SUSPENDED" ? "suspendu" : "intégration"}</Badge>
                    </span>
                  )}
                </div>

                <div className="relative min-h-16 flex-1 border-l border-ink-100">
                  {HOURS.map((hour) => (
                    <span
                      key={hour}
                      className="absolute inset-y-0 w-px bg-xd-graphite"
                      style={{ left: `${((hour * 60 - DAY_START_MIN) / SPAN) * 100}%` }}
                    />
                  ))}

                  {operator.jobs.map((job) => {
                    const left = position(job.start);
                    const width = (job.durationMin / SPAN) * 100;
                    return (
                      <Link
                        key={job.id}
                        href={`/admin/rendez-vous/${job.id}`}
                        title={`${job.reference} · ${job.customerName} · ${job.serviceName} · ${formatLocalTime(job.start)}–${formatLocalTime(job.end)} · trajet ${job.travelFromPreviousMin} min`}
                        className={`absolute top-2 flex h-12 flex-col justify-center overflow-hidden rounded-md border px-2 text-[11px] leading-tight transition hover:z-10 hover:shadow-md ${
                          job.conflict
                            ? "border-xd-danger/30 bg-xd-danger/12 text-xd-danger"
                            : job.tight
                              ? "border-xd-warn/30 bg-xd-warn/12 text-xd-warn"
                              : "border-brand-200 bg-brand-50 text-brand-900"
                        }`}
                        style={{ left: `${left}%`, width: `max(5rem, ${width}%)` }}
                      >
                        <span className="truncate font-semibold">{job.customerName || job.reference}</span>
                        <span className="tabular truncate opacity-80">
                          {formatLocalTime(job.start)} · {job.city}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {totalJobs === 0 && <EmptyState>Aucun rendez-vous planifié ce jour.</EmptyState>}

        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          Bordure rouge : trajet impossible depuis le rendez-vous précédent. Bordure orange :
          marge inférieure à {planning.settings.tightMarginMin} min. Estimations locales — la
          vérification qui fait autorité est celle du moteur au moment de l&apos;affectation.
        </p>
      </Card>

      <Card title="Détail des tournées">
        <div className="divide-y divide-ink-100">
          {planning.operators
            .filter((o) => o.jobs.length > 0)
            .map((operator) => (
              <div key={operator.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-ink-800">{operator.name}</p>
                <ol className="mt-2 space-y-1.5">
                  {operator.jobs.map((job) => (
                    <li key={job.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="tabular w-24 shrink-0 text-ink-500">
                        {formatLocalTime(job.start)}–{formatLocalTime(job.end)}
                      </span>
                      <Link href={`/admin/rendez-vous/${job.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {job.customerName || job.reference}
                      </Link>
                      <span className="text-ink-500">
                        {job.serviceName} · {job.addressLine1}, {job.city}
                      </span>
                      <StatusBadge status={job.status} />
                      <span className="tabular text-xs text-ink-400">
                        trajet {job.travelFromPreviousMin} min
                        {Number.isFinite(job.slackMin) && job.slackMin !== 0 && (
                          <span className={job.conflict ? " text-xd-danger" : job.tight ? " text-xd-warn" : ""}>
                            {" "}· marge {job.slackMin} min
                          </span>
                        )}
                      </span>
                      <span className="tabular ml-auto font-medium text-ink-700">
                        {formatEuros(job.totalCents)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </div>
        {totalJobs === 0 && <EmptyState>Rien à afficher.</EmptyState>}
      </Card>
    </div>
  );
}
