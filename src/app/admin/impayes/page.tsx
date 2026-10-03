import Link from "next/link";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate, formatLocalDateTime } from "@/server/time";
import { EmptyState, Footnote, MetricBar, Panel, StatusPill } from "@/components/ui";

export const metadata = { title: "Impayés · X Detailing OS" };
export const dynamic = "force-dynamic";

/**
 * Dossiers impayés (§36).
 *
 * « L'état impayé est sensible. Ne pas utiliser un rouge agressif sur tout l'écran. »
 *
 * L'écran n'alarme donc pas : il documente. Chaque dossier montre ce qui prouve que la
 * prestation a bien été réalisée — photos avant et après, signature du client, horodatage
 * de chaque étape. C'est ce qui transforme un litige en créance défendable.
 */
export default async function UnpaidPage() {
  await requireBackOffice();

  const unpaid = await prisma.appointment.findMany({
    where: { status: "UNPAID" },
    orderBy: { finishedAt: "desc" },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true, email: true } },
      operator: { select: { id: true, firstName: true, lastName: true } },
      service: { select: { name: true } },
      signature: { select: { signerName: true, signedAt: true } },
      photos: { select: { id: true, phase: true } },
      payments: { where: { status: "PAID" }, select: { amountCents: true } },
      events: { orderBy: { at: "asc" }, select: { type: true, at: true, note: true } },
    },
  });

  const owed = unpaid.reduce((sum, a) => {
    const paid = a.payments.reduce((s, p) => s + p.amountCents, 0);
    return sum + (a.totalCents - paid);
  }, 0);

  const complete = unpaid.filter(
    (a) => a.signature !== null && a.photos.filter((p) => p.phase === "AFTER").length >= 4,
  ).length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-h1 text-xd-text">Impayés</h1>
        <p className="mt-1 max-w-2xl text-body text-xd-text-3">
          Prestations réalisées et non réglées. Chaque dossier rassemble les preuves
          recueillies sur place.
        </p>
      </header>

      <MetricBar
        metrics={[
          {
            label: "Montant dû",
            value: formatEuros(owed),
            hint: `${unpaid.length} dossier${unpaid.length > 1 ? "s" : ""}`,
            tone: owed > 0 ? "warn" : "neutral",
          },
          {
            label: "Dossiers complets",
            value: `${complete} / ${unpaid.length}`,
            hint: "photos après et signature",
            tone: complete === unpaid.length ? "ok" : "warn",
          },
        ]}
      />

      {unpaid.length === 0 ? (
        <Panel>
          <EmptyState>Aucun impayé. Toutes les prestations réalisées ont été réglées.</EmptyState>
        </Panel>
      ) : (
        <div className="space-y-6">
          {unpaid.map((appointment) => {
            const paid = appointment.payments.reduce((sum, p) => sum + p.amountCents, 0);
            const due = appointment.totalCents - paid;
            const before = appointment.photos.filter((p) => p.phase === "BEFORE");
            const after = appointment.photos.filter((p) => p.phase === "AFTER");
            const name =
              appointment.customer.companyName ??
              `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim();

            return (
              <Panel
                key={appointment.id}
                title={
                  <span className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/admin/rendez-vous/${appointment.id}`}
                      className="text-xd-text transition-colors hover:text-xd-purple-bright"
                    >
                      {appointment.reference}
                    </Link>
                    <StatusPill tone="danger">Impayé</StatusPill>
                  </span>
                }
                action={
                  <span className="tabular text-h3 text-xd-warn">{formatEuros(due)}</span>
                }
              >
                <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  {/* ── Les faits ───────────────────────────────────────── */}
                  <dl className="space-y-2.5">
                    {[
                      ["Client", name],
                      ["Téléphone", appointment.customer.phone],
                      ["Prestation", `${appointment.service.name} · ${appointment.city}`],
                      [
                        "Réalisée le",
                        appointment.finishedAt
                          ? formatLocalDateTime(appointment.finishedAt)
                          : formatLocalDate(appointment.scheduledStart),
                      ],
                      [
                        "Opérateur",
                        appointment.operator
                          ? `${appointment.operator.firstName} ${appointment.operator.lastName}`
                          : "—",
                      ],
                      ["Total", formatEuros(appointment.totalCents)],
                      ["Déjà encaissé", formatEuros(paid)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-4">
                        <dt className="shrink-0 text-meta text-xd-text-4">{label}</dt>
                        <dd className="text-right text-meta text-xd-text-2">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {/* ── Les preuves ─────────────────────────────────────── */}
                  <div>
                    <p className="eyebrow text-xd-text-4">Dossier de preuve</p>

                    <ul className="mt-3 space-y-2">
                      <ProofRow
                        label="Photos avant"
                        satisfied={before.length >= 4}
                        detail={`${before.length} vue${before.length > 1 ? "s" : ""}`}
                      />
                      <ProofRow
                        label="Photos après"
                        satisfied={after.length >= 4}
                        detail={`${after.length} vue${after.length > 1 ? "s" : ""}`}
                      />
                      <ProofRow
                        label="Signature du client"
                        satisfied={appointment.signature !== null}
                        detail={
                          appointment.signature
                            ? `${appointment.signature.signerName}, ${formatLocalDateTime(appointment.signature.signedAt)}`
                            : "absente"
                        }
                      />
                    </ul>

                    {after.length > 0 && (
                      <ul className="mt-4 grid grid-cols-4 gap-1.5">
                        {after.slice(0, 4).map((photo) => (
                          <li key={photo.id}>
                            <a href={`/api/photos/${photo.id}`} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/photos/${photo.id}`}
                                alt="Photo après prestation"
                                loading="lazy"
                                className="hairline aspect-square w-full rounded-[--radius-xd-xs] object-cover"
                              />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* ── Chronologie ─────────────────────────────────────── */}
                <div className="hairline-t px-5 py-4">
                  <p className="eyebrow text-xd-text-4">Déroulé de la prestation</p>
                  <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    {appointment.events
                      .filter((event) => event.type !== "NOTE")
                      .map((event, index) => (
                        <li key={index} className="flex items-baseline gap-2">
                          <span className="tabular text-meta text-xd-text-4">
                            {formatLocalDateTime(event.at).split(" ").slice(-1)}
                          </span>
                          <span className="text-meta text-xd-text-3">
                            {EVENT_LABEL[event.type] ?? event.type}
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>

                <Footnote>
                  Ces éléments constituent la preuve d&apos;exécution : ils sont datés,
                  horodatés et journalisés. Contactez le client avant toute démarche de
                  recouvrement.
                </Footnote>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Créé",
  ASSIGNED: "Affecté",
  EN_ROUTE: "Départ",
  ARRIVED: "Arrivée",
  PHOTOS_BEFORE_VALIDATED: "Photos avant",
  STARTED: "Début",
  PHOTOS_AFTER_VALIDATED: "Photos après",
  PAYMENT_RECORDED: "Encaissement",
  COMPLETED: "Terminé",
};

function ProofRow({
  label,
  satisfied,
  detail,
}: {
  label: string;
  satisfied: boolean;
  detail: string;
}) {
  return (
    <li className="flex items-baseline gap-2.5">
      <span
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${satisfied ? "bg-xd-ok" : "bg-xd-danger"}`}
        aria-hidden
      />
      <span className="text-meta text-xd-text-2">{label}</span>
      <span className={`ml-auto text-meta ${satisfied ? "text-xd-text-4" : "text-xd-danger"}`}>
        {detail}
      </span>
    </li>
  );
}
