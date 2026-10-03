import { requireAdmin } from "@/lib/auth/guard";
import { getJobStatus } from "@/server/jobs";
import { getLoyaltyRule } from "@/server/loyalty";
import { prisma } from "@/server/db";
import { formatLocalDateTime } from "@/server/time";
import {
  Badge, Card, PageHeader, Td, Th,
} from "@/components/ui";
import { JobRunner, LoyaltyForm } from "./panels";

export const metadata = { title: "Automatisations · X Detailing OS" };
export const dynamic = "force-dynamic";

/** §37 phase 6 — automatisations et fidélité. */
export default async function AutomationsPage() {
  await requireAdmin();

  const [jobs, loyalty, rewards] = await Promise.all([
    getJobStatus(),
    getLoyaltyRule(),
    prisma.customerReward.groupBy({
      by: ["kind"],
      _count: { _all: true },
    }),
  ]);

  const unused = await prisma.customerReward.count({ where: { usedAt: null } });
  const neverRun = jobs.filter((job) => job.lastRunAt === null).length;
  const overdue = jobs.filter((job) => job.overdue).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Automatisations"
        lead={<>Ces tâches sont déclenchées par un ordonnanceur externe sur{" "} <code className="rounded bg-xd-graphite px-1 py-0.5 text-xs">/api/cron</code>. Un ordonnanceur embarqué dans le serveur web lierait les tâches à une instance unique, ce qui casserait à la première mise à l&apos;échelle.</>}
      />

      {(neverRun > 0 || overdue > 0) && (
        <p className="rounded-xl border border-xd-warn/30 bg-xd-warn/12 px-4 py-3 text-sm text-xd-warn">
          {neverRun > 0 && `${neverRun} tâche${neverRun > 1 ? "s n'ont" : " n'a"} jamais tourné. `}
          {overdue > 0 && `${overdue} tâche${overdue > 1 ? "s sont" : " est"} en retard. `}
          Vérifiez que l&apos;ordonnanceur appelle bien <code>/api/cron</code>.
        </p>
      )}

      <Card title="Tâches récurrentes">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-ink-50">
              <tr>
                <Th>Tâche</Th>
                <Th>Intervalle</Th>
                <Th>Dernière exécution</Th>
                <Th>Résultat</Th>
                <Th className="text-right">Lancer</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {jobs.map((job) => (
                <tr key={job.name} className="hover:bg-ink-50/60">
                  <Td>
                    <span className="font-medium text-ink-900">{job.label}</span>
                    <p className="mt-0.5 max-w-md text-xs text-ink-500">{job.description}</p>
                  </Td>
                  <Td className="tabular text-ink-600">
                    {job.everyMinutes >= 60
                      ? `${job.everyMinutes / 60} h`
                      : `${job.everyMinutes} min`}
                  </Td>
                  <Td>
                    {job.lastRunAt ? (
                      <>
                        <span className="tabular text-sm text-ink-700">
                          {formatLocalDateTime(job.lastRunAt)}
                        </span>
                        {job.overdue && (
                          <span className="ml-2"><Badge tone="warn">en retard</Badge></span>
                        )}
                      </>
                    ) : (
                      <Badge tone="danger">jamais</Badge>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {job.lastStatus === "SUCCESS" && job.lastSummary ? (
                      <span className="text-ink-600">
                        {Object.entries(job.lastSummary as Record<string, unknown>)
                          .map(([key, value]) => `${key} : ${value}`)
                          .join(" · ")}
                      </span>
                    ) : job.lastStatus === "FAILED" ? (
                      <span className="text-xd-danger">{job.lastError}</span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <JobRunner name={job.name} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <LoyaltyForm rule={loyalty} />

        <Card title="Récompenses">
          <dl className="divide-y divide-ink-100">
            {[
              ["Récompenses acquises", String(rewards.reduce((sum, r) => sum + r._count._all, 0))],
              ["Non utilisées", String(unused)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-sm text-ink-600">{label}</dt>
                <dd className="tabular text-sm font-medium text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
            Changer la règle n&apos;affecte que les récompenses à venir : celles déjà
            acquises restent dues au client.
          </p>
        </Card>
      </div>
    </div>
  );
}
