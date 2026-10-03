import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { formatEuros } from "@/server/pricing";
import {
  endOfLocalDay, formatLocalDateTime, formatMinutes, startOfLocalDay,
  startOfLocalMonth, startOfLocalWeek,
} from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatRow, StatTile, StatusBadge,
} from "@/components/ui";

const WEEKDAY_LABEL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const BILLABLE = [
  "ASSIGNED", "CONFIRMED", "EN_ROUTE", "ARRIVED", "PHOTOS_BEFORE",
  "IN_PROGRESS", "PHOTOS_AFTER", "PAYMENT", "COMPLETED",
] as const;

/** §22 — statistiques opérateur, §29 — véhicule et matériel. */
export default async function OperatorPage({ params }: PageProps<"/admin/operateurs/[id]">) {
  await requireBackOffice();
  const { id } = await params;

  const now = new Date();
  const dayStart = startOfLocalDay(now);
  const weekStart = startOfLocalWeek(now);
  const monthStart = startOfLocalMonth(now);

  const operator = await prisma.operator.findUnique({
    where: { id },
    include: {
      homeSector: true,
      coverage: { include: { sector: true } },
      services: { include: { service: { select: { name: true } } } },
      workingHours: { orderBy: { weekday: "asc" } },
      fleetVehicle: true,
      user: { select: { email: true, lastLoginAt: true } },
    },
  });

  if (!operator) notFound();

  const [day, week, month, reviews, upcoming, commissions] = await Promise.all([
    prisma.appointment.aggregate({
      where: { operatorId: id, scheduledStart: { gte: dayStart, lt: endOfLocalDay(now) }, status: { in: [...BILLABLE] } },
      _sum: { totalCents: true }, _count: { _all: true },
    }),
    prisma.appointment.aggregate({
      where: { operatorId: id, scheduledStart: { gte: weekStart }, status: { in: [...BILLABLE] } },
      _sum: { totalCents: true }, _count: { _all: true },
    }),
    prisma.appointment.aggregate({
      where: { operatorId: id, scheduledStart: { gte: monthStart }, status: { in: [...BILLABLE] } },
      _sum: { totalCents: true }, _count: { _all: true },
    }),
    prisma.review.aggregate({ where: { operatorId: id }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.appointment.findMany({
      where: { operatorId: id, scheduledStart: { gte: dayStart }, status: { in: [...BILLABLE] } },
      orderBy: { scheduledStart: "asc" },
      take: 12,
      include: { customer: { select: { firstName: true, lastName: true, companyName: true } }, service: { select: { name: true } } },
    }),
    prisma.commission.aggregate({
      where: { operatorId: id, createdAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
  ]);

  const monthRevenue = month._sum.totalCents ?? 0;
  const monthCount = month._count._all;
  const fillRate = operator.targetJobsPerDay > 0 ? day._count._all / operator.targetJobsPerDay : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={<>{operator.firstName} {operator.lastName}</>}
        badges={<><Badge tone={operator.status === "ACTIVE" ? "ok" : operator.status === "SUSPENDED" ? "danger" : "warn"}> {operator.status === "ACTIVE" ? "Actif" : operator.status === "SUSPENDED" ? "Suspendu" : "En intégration"} </Badge> {operator.homeSector && <Badge tone="neutral">{operator.homeSector.name}</Badge>}</>}
        lead={<>{operator.code} · {operator.phone} · {operator.user.email}</>}
        actions={<><Link href="/admin/operateurs" className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-sm text-ink-600 hover:bg-white/[0.09] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"> ← Opérateurs </Link></>}
      />

      <StatRow>
        <StatTile label="CA du jour" value={formatEuros(day._sum.totalCents ?? 0)} hint={`${day._count._all} prestation${day._count._all > 1 ? "s" : ""}`} />
        <StatTile label="CA semaine" value={formatEuros(week._sum.totalCents ?? 0)} hint={`${week._count._all} prestations`} />
        <StatTile label="CA mois" value={formatEuros(monthRevenue)} hint={`panier moyen ${formatEuros(monthCount ? Math.round(monthRevenue / monthCount) : 0)}`} />
        <StatTile
          label="Commission du mois"
          value={formatEuros(commissions._sum.amountCents ?? 0)}
          hint={`taux ${(Number(operator.commissionRate) * 100).toFixed(0)} %`}
          tone="positive"
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Tournée à venir">
          {upcoming.length === 0 ? (
            <EmptyState>Aucun rendez-vous à venir.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-100">
              {upcoming.map((appointment) => (
                <li key={appointment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="tabular w-40 shrink-0 text-ink-500">{formatLocalDateTime(appointment.scheduledStart)}</span>
                  <Link href={`/admin/rendez-vous/${appointment.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                    {appointment.customer.companyName ?? `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim()}
                  </Link>
                  <span className="text-ink-500">{appointment.service.name} · {appointment.city}</span>
                  <StatusBadge status={appointment.status} />
                  <span className="tabular ml-auto font-medium text-ink-700">{formatEuros(appointment.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Qualité et charge">
            <dl className="divide-y divide-ink-100">
              {[
                ["Score qualité", `${operator.qualityScore}/100`],
                ["Note moyenne", reviews._count._all ? `${reviews._avg.rating?.toFixed(1)} ★ (${reviews._count._all} avis)` : "aucun avis"],
                ["Remplissage du jour", `${day._count._all}/${operator.targetJobsPerDay} · ${Math.round(fillRate * 100)} %`],
                ["Dernière connexion", operator.user.lastLoginAt ? formatLocalDateTime(operator.user.lastLoginAt) : "jamais"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2">
                  <dt className="text-sm text-ink-600">{label}</dt>
                  <dd className="text-sm font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card title="Horaires">
            {operator.workingHours.length === 0 ? (
              <EmptyState>Aucun horaire défini — l&apos;opérateur ne peut recevoir aucun rendez-vous.</EmptyState>
            ) : (
              <ul className="divide-y divide-ink-100">
                {operator.workingHours.map((hours) => (
                  <li key={hours.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-ink-600">{WEEKDAY_LABEL[hours.weekday]}</span>
                    <span className="tabular text-ink-800">
                      {formatMinutes(hours.startMinute)}–{formatMinutes(hours.endMinute)}
                      {hours.breakStartMinute !== null && hours.breakEndMinute !== null && (
                        <span className="ml-2 text-xs text-ink-400">
                          pause {formatMinutes(hours.breakStartMinute)}–{formatMinutes(hours.breakEndMinute)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Périmètre">
            <div className="space-y-3 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Zones couvertes</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {operator.coverage.map((c) => <Badge key={c.id} tone="accent">{c.sector.name}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Prestations</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {operator.services.map((s) => <Badge key={s.id} tone="neutral">{s.service.name}</Badge>)}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Adresse de départ</p>
                <p className="mt-0.5 text-sm text-ink-700">{operator.homeAddress}</p>
              </div>
            </div>
          </Card>

          <Card title="Véhicule affecté">
            {operator.fleetVehicle ? (
              <dl className="divide-y divide-ink-100">
                {[
                  ["Immatriculation", operator.fleetVehicle.plate],
                  ["Modèle", `${operator.fleetVehicle.make} ${operator.fleetVehicle.model}`],
                  ["Kilométrage", `${operator.fleetVehicle.mileageKm.toLocaleString("fr-FR")} km`],
                  ["Financement", operator.fleetVehicle.financingType ?? "—"],
                  ["Assurance", operator.fleetVehicle.insuranceExpiresAt ? `jusqu'au ${formatLocalDateTime(operator.fleetVehicle.insuranceExpiresAt).split(" ")[0]}` : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2 text-sm">
                    <dt className="text-ink-600">{label}</dt>
                    <dd className="tabular font-medium text-ink-900">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState>Aucun Kangoo affecté.</EmptyState>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
