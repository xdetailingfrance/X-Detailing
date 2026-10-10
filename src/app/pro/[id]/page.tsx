import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireOperator } from "@/lib/auth/guard";
import { getPaymentSummary } from "@/server/payments";
import { classLabel } from "@/server/quoting";
import { formatLocalTime } from "@/server/time";
import { JobWorkflow } from "./workflow-client";

export const metadata = { title: "Prestation · X Detailing Pro" };
export const dynamic = "force-dynamic";

/**
 * §31 — les coordonnées du client ne sont dévoilées qu'à l'approche du rendez-vous.
 * Hors du corps de rendu : l'heure courante n'est pas une valeur pure.
 */
async function shouldRevealContact(scheduledStart: Date): Promise<boolean> {
  return scheduledStart.getTime() - Date.now() < 24 * 3600_000;
}

export default async function ProJobPage({ params }: PageProps<"/pro/[id]">) {
  const operator = await requireOperator();
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      customer: { select: { firstName: true, lastName: true, companyName: true, phone: true } },
      customerVehicle: { select: { make: true, model: true, plate: true, vehicleClass: true } },
      service: { select: { name: true } },
      options: { include: { option: { select: { name: true } } } },
      photos: { select: { id: true, phase: true, slot: true, takenAt: true } },
      signature: { select: { signerName: true, signedAt: true, paths: true } },
      vehicleAdjustment: true,
    },
  });

  // Filtrage par opérateur au niveau de la donnée, pas de l'affichage (§31).
  if (!appointment || appointment.operatorId !== operator.operatorId) notFound();

  // Ce que le client a photographié lui-même en réservant : l'opérateur doit savoir
  // s'il arrive avec une idée de l'état du véhicule, ou à l'aveugle.
  const clientPhotoCount = await prisma.photoAnalysisImage.count({
    where: { analysis: { appointmentId: appointment.id } },
  });

  const summary = await getPaymentSummary(appointment.id);

  const vehicle = appointment.customerVehicle;
  const vehicleLabel =
    [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") ||
    classLabel(appointment.vehicleClass);

  const adjustment = appointment.vehicleAdjustment
    ? {
        fromLabel: classLabel(appointment.vehicleAdjustment.fromClass),
        toLabel: classLabel(appointment.vehicleAdjustment.toClass),
        fromCents: appointment.vehicleAdjustment.fromCents,
        toCents: appointment.vehicleAdjustment.toCents,
        deltaCents: appointment.vehicleAdjustment.toCents - appointment.vehicleAdjustment.fromCents,
        accepted: appointment.vehicleAdjustment.acceptedAt !== null,
      }
    : null;

  const name =
    appointment.customer.companyName ??
    `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim();

  const fullAddress = `${appointment.addressLine1}, ${appointment.postalCode} ${appointment.city}`;

  const revealContact = await shouldRevealContact(appointment.scheduledStart);

  return (
    <div className="space-y-5">
      <Link href="/pro" className="inline-block text-sm text-chrome-400 transition hover:text-chrome-100">
        ← Ma journée
      </Link>

      <header>
        <p className="tabular font-display text-3xl font-extrabold tracking-tight text-xd-text">
          {formatLocalTime(appointment.scheduledStart)}
          <span className="ml-2 text-lg font-medium text-chrome-500">
            → {formatLocalTime(appointment.scheduledEnd)}
          </span>
        </p>
        <p className="mt-1.5 text-lg font-semibold text-chrome-100">{name}</p>
        <p className="mt-0.5 text-sm text-chrome-400">
          {appointment.service.name}
          {appointment.options.length > 0 &&
            ` + ${appointment.options.map((o) => o.option.name).join(", ")}`}
        </p>
      </header>

      <section className="rounded-xl border border-night-700 bg-night-850 p-4">
        <p className="text-base text-chrome-100">{fullAddress}</p>
        {appointment.accessNotes && (
          <p className="mt-1.5 text-sm text-xd-warn">Accès : {appointment.accessNotes}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-night-600 px-4 py-2.5 text-sm font-medium text-chrome-200 transition hover:border-brand-600"
          >
            Itinéraire
          </a>
          {revealContact && (
            <a
              href={`tel:${appointment.customer.phone}`}
              className="rounded-lg border border-night-600 px-4 py-2.5 text-sm font-medium text-chrome-200 transition hover:border-brand-600"
            >
              Appeler le client
            </a>
          )}
        </div>

        {appointment.customerVehicle && (
          <p className="mt-3 border-t border-night-700 pt-3 text-sm text-chrome-400">
            {[appointment.customerVehicle.make, appointment.customerVehicle.model]
              .filter(Boolean)
              .join(" ") || appointment.customerVehicle.vehicleClass.replace(/_/g, " ").toLowerCase()}
            {appointment.customerVehicle.plate && ` · ${appointment.customerVehicle.plate}`}
          </p>
        )}
      </section>

      <JobWorkflow
        appointmentId={appointment.id}
        status={appointment.status}
        startedAt={appointment.startedAt?.toISOString() ?? null}
        durationMin={appointment.durationMin}
        photos={appointment.photos.map((p) => ({ id: p.id, phase: p.phase, slot: p.slot }))}
        payment={{
          totalCents: summary.totalCents,
          depositPaidCents: summary.depositPaidCents,
          paidCents: summary.paidCents,
          balanceCents: summary.balanceCents,
          discrepancyCents: summary.discrepancyCents,
        }}
        vehicle={{
          currentClass: appointment.vehicleClass,
          currentLabel: classLabel(appointment.vehicleClass),
          label: vehicleLabel,
          adjustment,
        }}
        handover={{
          signed: appointment.signature !== null,
          signerName: appointment.signature?.signerName ?? null,
          paths: appointment.signature?.paths ?? null,
          signedAt: appointment.signature?.signedAt.toISOString() ?? null,
          summary: {
            client: name,
            vehicle: vehicleLabel,
            plate: vehicle?.plate ?? null,
            service: appointment.service.name,
            options: appointment.options.map((o) => o.option.name),
            totalCents: summary.totalCents,
            depositPaidCents: summary.depositPaidCents,
            balanceCents: summary.balanceCents,
          },
        }}
        job={{
          serviceName: appointment.service.name,
          addressLabel: `${appointment.addressLine1}, ${appointment.city}`,
          clientPhotoCount: clientPhotoCount,
        }}
      />
    </div>
  );
}
