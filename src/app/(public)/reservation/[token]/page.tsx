import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { formatEuros } from "@/server/pricing";
import { formatDuration, formatLocalDate, formatLocalTime } from "@/server/time";
import { getClientTracking } from "@/server/tracking";
import { ClientTrackingPanel } from "./client-tracking";

export const metadata = { title: "Votre réservation · X Detailing", robots: { index: false } };

// Le suivi doit refléter l'état réel : jamais de page mise en cache ici.
export const dynamic = "force-dynamic";

const VEHICLE_LABEL: Record<string, string> = {
  CITADINE: "Citadine", BERLINE: "Berline", BREAK: "Break", SUV: "SUV",
  QUATRE_X_QUATRE: "4x4", UTILITAIRE: "Utilitaire", SEPT_PLACES: "7 places",
};

/**
 * Suivi de réservation, accessible sans compte via un jeton aléatoire.
 *
 * N'expose que ce que le client a lui-même saisi, plus le prénom de l'opérateur. Ni son
 * nom complet, ni son téléphone, ni sa position (§31) — le suivi GPS arrive en phase 4,
 * et uniquement pendant le trajet.
 */
export default async function ReservationPage({
  params,
}: PageProps<"/reservation/[token]">) {
  const { token } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { publicToken: token },
    include: {
      service: { select: { name: true } },
      operator: { select: { firstName: true } },
      options: { include: { option: { select: { name: true } } } },
      payments: { where: { kind: "DEPOSIT" }, orderBy: { createdAt: "desc" }, take: 1 },
      review: { select: { rating: true } },
    },
  });

  if (!appointment) notFound();

  const tracking = await getClientTracking(token);
  const deposit = appointment.payments[0];
  const completed = appointment.status === "COMPLETED";
  const depositUrl = (deposit?.providerPayload as { url?: string } | null)?.url ?? null;
  const cancelled = appointment.status === "CANCELLED";

  // La facture est émise à la clôture, sans action du client : on se contente de
  // vérifier qu'elle existe pour proposer le lien (§24).
  const invoice = completed
    ? await prisma.jobInvoice.findUnique({
        where: { appointmentId: appointment.id },
        select: { number: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-xl px-5 pb-20 pt-28 sm:pt-32">
      <div className={`rounded-2xl border p-6 ${cancelled ? "border-night-600 bg-night-900" : "border-brand-700 bg-brand-600/15"}`}>
        <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-brand-400">
          {cancelled ? "Réservation annulée" : "Réservation confirmée"}
        </p>
        <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight text-white">
          {appointment.operator
            ? `${appointment.operator.firstName} vient laver votre véhicule`
            : "Votre lavage est enregistré"}
        </h1>
        <p className="mt-2 text-base text-chrome-200">
          <span className="font-semibold capitalize">{formatLocalDate(appointment.scheduledStart)}</span>{" "}
          à <span className="font-semibold">{formatLocalTime(appointment.scheduledStart)}</span>
          <span className="text-chrome-400">
            {" "}· jusqu&apos;à {formatLocalTime(appointment.scheduledEnd)} environ
          </span>
        </p>
        <p className="mt-1 text-sm text-chrome-300">
          {appointment.addressLine1}, {appointment.postalCode} {appointment.city}
        </p>
      </div>

      {tracking && <ClientTrackingPanel token={token} initial={tracking} />}

      <dl className="mt-6 divide-y divide-night-700 rounded-2xl border border-night-600">
        {[
          ["Référence", appointment.reference],
          ["Prestation", appointment.service.name],
          ["Véhicule", VEHICLE_LABEL[appointment.vehicleClass] ?? appointment.vehicleClass],
          ...(appointment.options.length > 0
            ? [["Options", appointment.options.map((o) => o.option.name).join(", ")] as const]
            : []),
          ["Durée estimée", `${formatDuration(appointment.durationMin)} sur place`],
          ["Total", formatEuros(appointment.totalCents)],
          ["Acompte", `${formatEuros(appointment.depositCents)}${deposit?.status === "PAID" ? " — réglé" : " — à régler"}`],
          ["Solde sur place", formatEuros(appointment.totalCents - appointment.depositCents)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-chrome-300">{label}</dt>
            <dd className="tabular text-right text-sm font-medium text-white">{value}</dd>
          </div>
        ))}
      </dl>

      {!cancelled && depositUrl && deposit?.status !== "PAID" && (
        <Link
          href={depositUrl}
          className="mt-5 block rounded-xl bg-brand-600 px-5 py-3.5 text-center text-base font-semibold text-white transition hover:bg-brand-500"
        >
          Régler l&apos;acompte de {formatEuros(appointment.depositCents)}
        </Link>
      )}

      {completed && !appointment.review && (
        <Link
          href={`/avis/${token}`}
          className="press glass glass-interactive mt-5 block rounded-[--radius-xd-lg] px-5 py-4 text-center text-body font-semibold text-xd-text"
        >
          Donner mon avis sur la prestation
        </Link>
      )}

      {invoice && (
        <Link
          href={`/reservation/${token}/facture`}
          className="press glass glass-interactive mt-3 flex items-center justify-between gap-3 rounded-[--radius-xd-lg] px-5 py-4"
        >
          <span>
            <span className="block text-body font-medium text-xd-text">Votre facture</span>
            <span className="tabular mt-0.5 block text-meta text-xd-text-3">
              {invoice.number} · émise automatiquement
            </span>
          </span>
          <span aria-hidden className="text-xd-text-3">→</span>
        </Link>
      )}

      <section className="mt-8">
        <h2 className="font-display text-base font-bold text-white">Et ensuite ?</h2>
        <ul className="mt-3 space-y-3 text-sm leading-relaxed text-chrome-300">
          <li>
            <span className="font-medium text-chrome-200">Le jour J</span> — vous recevrez un
            message quand votre opérateur prend la route, avec son heure d&apos;arrivée.
          </li>
          <li>
            <span className="font-medium text-chrome-200">À son arrivée</span> — il photographie
            l&apos;état de votre véhicule avant de commencer, puis après la prestation.
          </li>
          <li>
            <span className="font-medium text-chrome-200">À la fin</span> — vous réglez le solde
            sur place et recevez le récapitulatif complet avec les photos.
          </li>
        </ul>
      </section>

      <p className="mt-8 rounded-xl bg-night-900 px-4 py-3 text-sm text-chrome-300">
        Un imprévu ? Appelez-nous au{" "}
        <a href="tel:+33400000000" className="font-medium text-brand-400 underline">
          04 00 00 00 00
        </a>{" "}
        en précisant la référence {appointment.reference}.
      </p>

      <p className="mt-6 text-center">
        <Link href="/" className="text-sm text-chrome-400 underline hover:text-chrome-200">
          Retour à l&apos;accueil
        </Link>
      </p>
    </div>
  );
}
