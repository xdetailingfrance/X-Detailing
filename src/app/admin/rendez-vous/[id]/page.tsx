import { SLOT_LABEL } from "@/server/workflow/types";
import { SignatureView } from "@/components/signature-view";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { formatEuros } from "@/server/pricing";
import { formatLocalDateTime, formatLocalTime } from "@/server/time";
import {
  Badge, Card, EmptyState, PageHeader, StatusBadge, Td, Th,
} from "@/components/ui";
import type { Candidate } from "@/server/assignment/types";
import { CashSettlement } from "./cash-settlement";


const EVENT_LABEL: Record<string, string> = {
  CREATED: "Rendez-vous créé",
  ASSIGNMENT_RUN: "Moteur d'affectation exécuté",
  ASSIGNED: "Opérateur affecté",
  OPERATOR_CHANGED: "Opérateur modifié",
  CONFIRMED: "Confirmé",
  RESCHEDULED: "Reprogrammé",
  EN_ROUTE: "Trajet démarré",
  ARRIVED: "Arrivée sur place",
  PHOTOS_BEFORE_VALIDATED: "Photos avant validées",
  STARTED: "Prestation démarrée",
  PHOTOS_AFTER_VALIDATED: "Photos après validées",
  PAYMENT_RECORDED: "Paiement enregistré",
  COMPLETED: "Prestation terminée",
  CANCELLED: "Annulé",
  NO_SHOW: "Client absent",
  NOTE: "Note",
};

/** Étapes du workflow verrouillé (§12), avec leur horodatage s'il existe. */
const WORKFLOW_STEPS = [
  { key: "enRouteAt", label: "Trajet démarré" },
  { key: "arrivedAt", label: "Arrivé" },
  { key: "photosBeforeAt", label: "Photos avant" },
  { key: "startedAt", label: "Prestation démarrée" },
  { key: "photosAfterAt", label: "Photos après" },
  { key: "paidAt", label: "Encaissement" },
  { key: "finishedAt", label: "Terminé" },
] as const;

/** Ce que la signature a figé, nommé pour un lecteur humain. */
const ACKNOWLEDGED_LABEL: Record<string, string> = {
  reference: "Référence",
  service: "Prestation",
  vehicle: "Véhicule",
  plate: "Plaque",
  options: "Options",
  totalCents: "Total",
  depositCents: "Acompte",
  depositPaidCents: "Acompte réglé",
  balanceCents: "Solde",
  durationMin: "Durée",
  vehicleClass: "Catégorie",
};

export default async function AppointmentPage({ params }: PageProps<"/admin/rendez-vous/[id]">) {
  await requireBackOffice();
  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      customer: true,
      customerVehicle: true,
      service: true,
      operator: { select: { id: true, code: true, firstName: true, lastName: true, phone: true } },
      sector: { select: { name: true, color: true } },
      options: { include: { option: { select: { name: true } } } },
      signature: true,
      events: { orderBy: { at: "asc" }, include: { user: { select: { firstName: true, lastName: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
      photos: { orderBy: [{ phase: "asc" }, { takenAt: "asc" }] },
      assignmentRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      commission: true,
    },
  });

  if (!appointment) notFound();

  const customerName =
    appointment.customer.companyName ??
    `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim();

  const run = appointment.assignmentRuns[0];
  const candidates = (run?.candidates ?? []) as unknown as Candidate[];
  const paidCents = appointment.payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const discrepancyCents = appointment.payments.reduce((sum, p) => sum + p.discrepancyCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={<>{appointment.reference}</>}
        badges={<><StatusBadge status={appointment.status} /> {appointment.sector && <Badge tone="neutral">{appointment.sector.name}</Badge>}</>}
        lead={<>{formatLocalDateTime(appointment.scheduledStart)} → {formatLocalTime(appointment.scheduledEnd)} ·{" "} {appointment.durationMin} min</>}
        actions={<><Link href="/admin/planning" className="rounded-lg bg-black/[0.045] px-3 py-1.5 text-sm text-ink-600 hover:bg-black/[0.06] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"> ← Planning </Link></>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Prestation">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-3">
              {[
                ["Client", customerName],
                ["Téléphone", appointment.customer.phone],
                ["Véhicule", `${appointment.vehicleClass.replace(/_/g, " ").toLowerCase()}${appointment.customerVehicle?.make ? ` · ${appointment.customerVehicle.make} ${appointment.customerVehicle.model ?? ""}` : ""}`],
                ["Adresse", `${appointment.addressLine1}, ${appointment.postalCode} ${appointment.city}`],
                ["Prestation", appointment.service.name],
                ["Opérateur", appointment.operator ? `${appointment.operator.firstName} ${appointment.operator.lastName}` : "non affecté"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
                  <dd className="mt-0.5 text-sm text-ink-800">{value}</dd>
                </div>
              ))}
            </dl>

            {appointment.options.length > 0 && (
              <ul className="flex flex-wrap gap-2 border-t border-ink-100 px-4 py-3">
                {appointment.options.map((o) => (
                  <li key={o.id}>
                    <Badge tone="accent">
                      {o.option.name} · {formatEuros(o.priceCents)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            {appointment.accessNotes && (
              <p className="border-t border-ink-100 px-4 py-3 text-sm text-ink-600">
                <span className="font-medium text-ink-800">Accès : </span>
                {appointment.accessNotes}
              </p>
            )}
          </Card>

          <Card title="Workflow d'exécution">
            <ol className="divide-y divide-ink-100">
              {WORKFLOW_STEPS.map((step) => {
                const at = appointment[step.key] as Date | null;
                return (
                  <li key={step.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`size-2 shrink-0 rounded-full ${at ? "bg-xd-ok" : "bg-xd-slate"}`} />
                    <span className={`text-sm ${at ? "text-ink-800" : "text-ink-400"}`}>{step.label}</span>
                    <span className="tabular ml-auto text-xs text-ink-500">
                      {at ? formatLocalDateTime(at) : "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
              Chaque étape est verrouillée par la précédente (§12), côté serveur : masquer un
              bouton ne verrouille rien.
            </p>
          </Card>

          {run && (
            <Card
              title="Décision du moteur"
              action={
                <span className="text-xs text-ink-500">
                  {run.manualOverride ? "choix manuel du back-office" : "proposition retenue"}
                </span>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-ink-50">
                    <tr>
                      <Th>Candidat</Th>
                      <Th className="text-right">Score</Th>
                      <Th className="text-right">Trajet</Th>
                      <Th className="text-right">RDV du jour</Th>
                      <Th className="text-right">CA semaine</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {candidates.map((candidate) => (
                      <tr key={candidate.operatorId} className={candidate.operatorId === run.chosenOperatorId ? "bg-brand-50/60" : ""}>
                        <Td>
                          {candidate.operatorName}
                          {candidate.operatorId === run.chosenOperatorId && (
                            <span className="ml-2"><Badge tone="accent">retenu</Badge></span>
                          )}
                          {!candidate.comparable && (
                            <span className="ml-2"><Badge tone="neutral">hors cohorte</Badge></span>
                          )}
                        </Td>
                        <Td className="tabular text-right font-medium">{candidate.score}</Td>
                        <Td className="tabular text-right">{candidate.travelMin} min</Td>
                        <Td className="tabular text-right">{candidate.jobsToday}</Td>
                        <Td className="tabular text-right">{formatEuros(candidate.revenueWeekCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
                Exécution archivée le {formatLocalDateTime(run.createdAt)} en {run.durationMs} ms — rejouable à
                l&apos;identique lors d&apos;un audit (§30).
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Montants">
            <dl className="divide-y divide-ink-100">
              {[
                ["Prestation", formatEuros(appointment.priceCents)],
                ["Options", formatEuros(appointment.optionsPriceCents)],
                ["Total", formatEuros(appointment.totalCents)],
                ["Acompte prévu", formatEuros(appointment.depositCents)],
                ["Encaissé", formatEuros(paidCents)],
                ["Reste dû", formatEuros(appointment.totalCents - paidCents)],
                [
                  "Commission 18 %",
                  appointment.commission
                    ? formatEuros(appointment.commission.amountCents)
                    : `${formatEuros(Math.round(appointment.totalCents * 0.18))} (à la clôture)`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-ink-600">{label}</dt>
                  <dd className="tabular text-sm font-medium text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>

            {discrepancyCents !== 0 && (
              <CashSettlement appointmentId={appointment.id} discrepancyCents={discrepancyCents} />
            )}
          </Card>

          <Card title="Preuves photo">
            {appointment.photos.length === 0 ? (
              <EmptyState>Aucune photo pour l&apos;instant.</EmptyState>
            ) : (
              (["BEFORE", "AFTER"] as const).map((phase) => {
                const shots = appointment.photos.filter((p) => p.phase === phase);
                if (shots.length === 0) return null;

                return (
                  <div key={phase} className="border-b border-ink-100 p-3 last:border-b-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {phase === "BEFORE" ? "Avant prestation" : "Après prestation"}
                    </p>
                    <ul className="grid grid-cols-2 gap-2">
                      {shots.map((photo) => (
                        <li key={photo.id}>
                          <a
                            href={`/api/photos/${photo.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-ink-200"
                          >
                            {/* Route authentifiée, pas un fichier public : `next/image`
                                n'apporterait rien et ajouterait un cache intermédiaire. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/photos/${photo.id}`}
                              alt={`${phase === "BEFORE" ? "Avant" : "Après"} — ${SLOT_LABEL[photo.slot]}`}
                              className="aspect-[4/3] w-full bg-xd-graphite object-cover"
                              loading="lazy"
                            />
                          </a>
                          <p className="mt-1 text-[11px] text-ink-500">
                            {SLOT_LABEL[photo.slot]}
                            {!photo.capturedInApp && (
                              <span className="ml-1 text-xd-warn">· importée</span>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
            {appointment.customerVehicleId && (
              <p className="border-t border-ink-100 px-4 py-2 text-xs">
                <Link
                  href={`/admin/vehicules/${appointment.customerVehicleId}`}
                  className="text-brand-600 hover:underline"
                >
                  Voir l&apos;historique complet du véhicule (§26)
                </Link>
              </p>
            )}
          </Card>

          {/*
            §36 — le bon signé est ce qui rend un impayé opposable : il fige ce que le
            client a approuvé au moment où il l'a approuvé. Il se lit donc à côté des
            photos, pas dans le journal.
          */}
          <Card title="Bon de prise en charge">
            {appointment.signature ? (
              <div className="px-4 py-4">
                <p className="text-meta text-xd-text-3">
                  Signé par{" "}
                  <span className="text-xd-text">{appointment.signature.signerName}</span>{" "}
                  le {formatLocalDateTime(appointment.signature.signedAt)}
                </p>
                <SignatureView paths={appointment.signature.paths} className="mt-3" />
                <dl className="mt-4 space-y-1 text-meta">
                  {Object.entries(
                    (appointment.signature.acknowledged ?? {}) as Record<string, unknown>,
                  ).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <dt className="text-xd-text-4">{ACKNOWLEDGED_LABEL[key] ?? key}</dt>
                      <dd className="tabular text-xd-text-2">
                        {typeof value === "number" && key.endsWith("Cents")
                          ? formatEuros(value)
                          : String(value ?? "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <EmptyState>
                Aucun bon signé. Sans lui, une prestation impayée ne s&apos;appuie que sur
                les photos.
              </EmptyState>
            )}
          </Card>

          <Card title="Journal">
            {appointment.events.length === 0 ? (
              <EmptyState>Aucun événement.</EmptyState>
            ) : (
              <ol className="divide-y divide-ink-100">
                {appointment.events.map((event) => (
                  <li key={event.id} className="px-4 py-2.5">
                    <p className="text-sm text-ink-800">{EVENT_LABEL[event.type] ?? event.type}</p>
                    {event.note && <p className="text-xs text-ink-500">{event.note}</p>}
                    <p className="tabular mt-0.5 text-xs text-ink-400">
                      {formatLocalDateTime(event.at)}
                      {event.user && ` · ${event.user.firstName} ${event.user.lastName}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
