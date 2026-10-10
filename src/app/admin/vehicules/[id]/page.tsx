import { SLOT_LABEL } from "@/server/workflow/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate, formatLocalDateTime } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatRow, StatTile, StatusBadge,
} from "@/components/ui";

export const metadata = { title: "Fiche véhicule · X Detailing OS" };

const VEHICLE_LABEL: Record<string, string> = {
  CITADINE: "Citadine", BERLINE: "Berline", BREAK: "Break", SUV: "SUV",
  QUATRE_X_QUATRE: "4x4", UTILITAIRE: "Utilitaire", SEPT_PLACES: "7 places",
};


/**
 * §26 — fiche digitale du véhicule.
 *
 * « Chaque véhicule dispose d'un historique permanent. Objectif : créer une preuve
 * visuelle et une traçabilité complète. » L'historique survit donc au rendez-vous : les
 * photos sont rattachées au véhicule, pas seulement à la prestation qui les a produites.
 */
export default async function VehiclePage({ params }: PageProps<"/admin/vehicules/[id]">) {
  await requireBackOffice();
  const { id } = await params;

  const vehicle = await prisma.customerVehicle.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
      appointments: {
        orderBy: { scheduledStart: "desc" },
        include: {
          service: { select: { name: true } },
          operator: { select: { firstName: true, lastName: true } },
          photos: { select: { id: true, phase: true, slot: true, takenAt: true, capturedInApp: true } },
        },
      },
    },
  });

  if (!vehicle) notFound();

  const customerName =
    vehicle.customer.companyName ??
    `${vehicle.customer.firstName ?? ""} ${vehicle.customer.lastName ?? ""}`.trim();

  const washes = vehicle.appointments.filter((a) => a.status === "COMPLETED");
  const totalCents = washes.reduce((sum, a) => sum + a.totalCents, 0);
  const label =
    [vehicle.make, vehicle.model].filter(Boolean).join(" ") || VEHICLE_LABEL[vehicle.vehicleClass];

  return (
    <div className="space-y-5">
      <PageHeader
        title={<>{label}</>}
        badges={<><Badge tone="neutral">{VEHICLE_LABEL[vehicle.vehicleClass]}</Badge> {vehicle.plate && <Badge tone="accent">{vehicle.plate}</Badge>}</>}
        lead={<><Link href={`/admin/clients/${vehicle.customer.id}`} className="hover:text-brand-600"> {customerName} </Link></>}
        actions={<><Link href={`/admin/clients/${vehicle.customer.id}`} className="rounded-lg bg-black/[0.045] px-3 py-2 text-sm text-ink-600 hover:bg-black/[0.06] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]" > ← Fiche client </Link></>}
      />

      <StatRow columns={3}>
        <StatTile label="Lavages réalisés" value={String(washes.length)} />
        <StatTile label="Total facturé" value={formatEuros(totalCents)} />
        <StatTile
          label="Dernier lavage"
          value={washes[0] ? formatLocalDate(washes[0].scheduledStart) : "—"}
          hint={washes[0]?.service.name}
        />
      </StatRow>

      {vehicle.appointments.length === 0 ? (
        <Card><EmptyState>Aucune prestation sur ce véhicule.</EmptyState></Card>
      ) : (
        <div className="space-y-5">
          {vehicle.appointments.map((appointment) => (
            <Card
              key={appointment.id}
              title={
                <span className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/rendez-vous/${appointment.id}`}
                    className="text-ink-900 hover:text-brand-600"
                  >
                    {formatLocalDate(appointment.scheduledStart)}
                  </Link>
                  <StatusBadge status={appointment.status} />
                </span>
              }
              action={
                <span className="tabular text-xs text-ink-500">
                  {appointment.service.name} · {formatEuros(appointment.totalCents)}
                </span>
              }
            >
              <div className="px-4 py-3">
                <p className="text-sm text-ink-600">
                  {appointment.operator
                    ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
                    : "opérateur non affecté"}
                  {" · "}
                  {appointment.addressLine1}, {appointment.city}
                </p>

                {appointment.photos.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-400">Aucune preuve photo.</p>
                ) : (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {(["BEFORE", "AFTER"] as const).map((phase) => {
                      const shots = appointment.photos.filter((p) => p.phase === phase);
                      if (shots.length === 0) return null;

                      return (
                        <div key={phase}>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                            {phase === "BEFORE" ? "Avant" : "Après"}
                          </p>
                          <ul className="grid grid-cols-4 gap-1.5">
                            {shots.map((photo) => (
                              <li key={photo.id}>
                                <a href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/photos/${photo.id}`}
                                    alt={`${phase === "BEFORE" ? "Avant" : "Après"} — ${SLOT_LABEL[photo.slot]}`}
                                    title={`${SLOT_LABEL[photo.slot]} · ${formatLocalDateTime(photo.takenAt)}`}
                                    className="aspect-square w-full rounded border border-ink-200 bg-xd-graphite object-cover"
                                    loading="lazy"
                                  />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
