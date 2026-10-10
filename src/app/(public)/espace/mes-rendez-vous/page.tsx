import Link from "next/link";
import { prisma } from "@/server/db";
import { requireCustomer } from "@/lib/auth/guard";
import { closeCustomerSession } from "../actions";
import { formatEuros } from "@/server/pricing";
import { formatLocalDate, formatLocalTime } from "@/server/time";
import { APPOINTMENT_STATUS, StatusPill } from "@/components/ui";

export const metadata = { title: "Mes rendez-vous · X Detailing", robots: { index: false } };
export const dynamic = "force-dynamic";

const VEHICLE_LABEL: Record<string, string> = {
  CITADINE: "Citadine", BERLINE: "Berline", BREAK: "Break", SUV: "SUV",
  QUATRE_X_QUATRE: "4x4", UTILITAIRE: "Utilitaire", SEPT_PLACES: "7 places",
};

/**
 * §24 — « l'espace client doit être simple ».
 *
 * Le prochain rendez-vous d'abord, en grand ; l'historique ensuite, replié en liste.
 * Pas de tableau de bord d'entreprise : un client veut savoir quand on passe, et
 * retrouver ses factures.
 */
export default async function CustomerAppointmentsPage() {
  const customer = await requireCustomer();

  const now = new Date();
  const [upcoming, past, vehicles] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        customerId: customer.customerId,
        scheduledStart: { gte: now },
        status: { notIn: ["CANCELLED", "DRAFT", "PENDING_ASSIGNMENT"] },
      },
      orderBy: { scheduledStart: "asc" },
      include: {
        service: { select: { name: true } },
        operator: { select: { firstName: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { customerId: customer.customerId, scheduledStart: { lt: now } },
      orderBy: { scheduledStart: "desc" },
      take: 12,
      include: {
        service: { select: { name: true } },
        review: { select: { rating: true } },
        _count: { select: { photos: true } },
      },
    }),
    prisma.customerVehicle.findMany({
      where: { customerId: customer.customerId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const next = upcoming[0];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-xd-purple-bright">Espace client</p>
          <h1 className="mt-2 text-h2 text-xd-text">{customer.name}</h1>
        </div>
        <form action={closeCustomerSession}>
          <button type="submit" className="text-meta text-xd-text-4 transition-colors hover:text-xd-text-2">
            Se déconnecter
          </button>
        </form>
      </header>

      {/* ── Le prochain rendez-vous, en premier (§24) ───────────────────── */}
      {next ? (
        <section className="m-purple mt-8 rounded-[--radius-xd-xl] p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="eyebrow text-xd-purple-bright">Prochain lavage</p>
            <StatusPill tone={APPOINTMENT_STATUS[next.status]?.tone ?? "neutral"}>
              {APPOINTMENT_STATUS[next.status]?.label ?? next.status}
            </StatusPill>
          </div>

          <p className="mt-3 text-h2 text-xd-text first-letter:uppercase">
            {formatLocalDate(next.scheduledStart)}
          </p>
          <p className="tabular mt-1 text-body text-xd-text-2">
            {formatLocalTime(next.scheduledStart)} → {formatLocalTime(next.scheduledEnd)}
            {next.operator && ` · avec ${next.operator.firstName}`}
          </p>
          <p className="mt-3 text-body text-xd-text-3">
            {next.service.name} · {next.addressLine1}, {next.city}
          </p>
          <p className="tabular mt-1 text-body text-xd-text-2">
            {formatEuros(next.totalCents)}
          </p>

          <Link
            href={`/reservation/${next.publicToken}`}
            className="press mt-5 inline-flex rounded-[--radius-xd-sm] bg-black/[0.07] px-4 py-2.5 text-meta font-medium text-xd-text transition-colors hover:bg-black/[0.1]"
          >
            Suivre ce rendez-vous
          </Link>
        </section>
      ) : (
        <section className="m-graphite mt-8 rounded-[--radius-xd-xl] p-6">
          <p className="text-h3 text-xd-text">Aucun lavage prévu</p>
          <p className="mt-2 text-body text-xd-text-3">
            Votre véhicule mérite mieux que ça.
          </p>
          <Link
            href="/reserver"
            className="press mt-5 inline-flex rounded-[--radius-xd-sm] bg-xd-purple px-5 py-3 text-meta font-semibold text-white transition-colors hover:bg-xd-purple-bright"
          >
            Réserver un lavage
          </Link>
        </section>
      )}

      {upcoming.length > 1 && (
        <section className="mt-6">
          <h2 className="eyebrow text-xd-text-4">Également prévu</h2>
          <ul className="mt-3 space-y-2">
            {upcoming.slice(1).map((appointment) => (
              <li key={appointment.id}>
                <Link
                  href={`/reservation/${appointment.publicToken}`}
                  className="hairline flex items-baseline justify-between gap-3 rounded-[--radius-xd-md] px-4 py-3 transition-colors hover:bg-black/[0.025]"
                >
                  <span className="text-body text-xd-text-2 first-letter:uppercase">
                    {formatLocalDate(appointment.scheduledStart)} · {appointment.service.name}
                  </span>
                  <span className="tabular shrink-0 text-meta text-xd-text-3">
                    {formatEuros(appointment.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Véhicules ───────────────────────────────────────────────────── */}
      {vehicles.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow text-xd-text-4">
            {vehicles.length > 1 ? "Mes véhicules" : "Mon véhicule"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {vehicles.map((vehicle) => (
              <li
                key={vehicle.id}
                className="hairline rounded-[--radius-xd-sm] px-3.5 py-2 text-meta text-xd-text-2"
              >
                {[vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                  VEHICLE_LABEL[vehicle.vehicleClass]}
                {vehicle.plate && <span className="ml-2 text-xd-text-4">{vehicle.plate}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Historique ──────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow text-xd-text-4">Lavages précédents</h2>
          <ul className="mt-3">
            {past.map((appointment, index) => (
              <li key={appointment.id} className={index > 0 ? "hairline-t" : ""}>
                <Link
                  href={`/reservation/${appointment.publicToken}`}
                  className="flex items-baseline justify-between gap-3 py-3.5 transition-colors hover:text-xd-text"
                >
                  <span>
                    <span className="block text-body text-xd-text-2 first-letter:uppercase">
                      {formatLocalDate(appointment.scheduledStart)}
                    </span>
                    <span className="mt-0.5 block text-meta text-xd-text-4">
                      {appointment.service.name}
                      {appointment._count.photos > 0 && ` · ${appointment._count.photos} photos`}
                      {appointment.review && ` · ${appointment.review.rating}/5`}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-meta text-xd-text-3">
                    {formatEuros(appointment.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
