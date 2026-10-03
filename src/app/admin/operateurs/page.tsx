import { buttonClass } from "@/components/button-style";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { formatEuros } from "@/server/pricing";
import { startOfLocalWeek } from "@/server/time";
import {
  Badge, Card, PageHeader, Td, Th,
} from "@/components/ui";

export const metadata = { title: "Opérateurs · X Detailing OS" };

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "neutral" | "danger" }> = {
  ACTIVE: { label: "Actif", tone: "ok" },
  ONBOARDING: { label: "En intégration", tone: "warn" },
  SUSPENDED: { label: "Suspendu", tone: "danger" },
  ARCHIVED: { label: "Archivé", tone: "neutral" },
};

export default async function OperatorsPage() {
  await requireBackOffice();

  const weekStart = startOfLocalWeek(new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600_000);

  const [operators, weekRevenue] = await Promise.all([
    prisma.operator.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
      include: {
        homeSector: { select: { name: true } },
        coverage: { include: { sector: { select: { code: true } } } },
        services: { select: { serviceId: true } },
        fleetVehicle: { select: { plate: true } },
      },
    }),
    prisma.appointment.groupBy({
      by: ["operatorId"],
      where: {
        scheduledStart: { gte: weekStart, lt: weekEnd },
        status: { notIn: ["CANCELLED", "NO_SHOW", "DRAFT", "PENDING_ASSIGNMENT"] },
      },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
  ]);

  const byOperator = new Map(
    weekRevenue.map((r) => [r.operatorId, { cents: r._sum.totalCents ?? 0, count: r._count._all }]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Opérateurs du réseau"
        lead="Un opérateur activé entre immédiatement dans le moteur d'affectation et dans le planning (§28)."
        actions={
          <Link href="/admin/operateurs/nouveau" className={buttonClass("primary")}>
            Nouvel opérateur
          </Link>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-ink-50">
              <tr>
                <Th>Opérateur</Th>
                <Th>Statut</Th>
                <Th>Secteur</Th>
                <Th>Zones couvertes</Th>
                <Th>Kangoo</Th>
                <Th className="text-right">RDV semaine</Th>
                <Th className="text-right">CA semaine</Th>
                <Th className="text-right">Qualité</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {operators.map((operator) => {
                const week = byOperator.get(operator.id) ?? { cents: 0, count: 0 };
                const status = STATUS[operator.status];
                return (
                  <tr key={operator.id} className="hover:bg-ink-50/60">
                    <Td>
                      <Link href={`/admin/operateurs/${operator.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {operator.firstName} {operator.lastName}
                      </Link>
                      <p className="text-xs text-ink-400">{operator.code} · {operator.phone}</p>
                    </Td>
                    <Td><Badge tone={status.tone}>{status.label}</Badge></Td>
                    <Td>{operator.homeSector?.name ?? "—"}</Td>
                    <Td className="text-xs text-ink-500">
                      {operator.coverage.map((c) => c.sector.code).join(", ") || "—"}
                    </Td>
                    <Td className="tabular text-xs text-ink-500">{operator.fleetVehicle?.plate ?? "—"}</Td>
                    <Td className="tabular text-right">{week.count}</Td>
                    <Td className="tabular text-right font-medium">{formatEuros(week.cents)}</Td>
                    <Td className="tabular text-right">{operator.qualityScore}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
