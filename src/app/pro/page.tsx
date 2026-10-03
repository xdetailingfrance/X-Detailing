import Link from "next/link";
import { prisma } from "@/server/db";
import { requireOperator } from "@/lib/auth/guard";
import { formatEuros } from "@/server/pricing";
import { endOfLocalDay, formatLocalDate, formatLocalTime, startOfLocalDay } from "@/server/time";

export const metadata = { title: "Ma journée · X Detailing Pro" };

/** §10 — agenda personnel de l'opérateur. */
export const dynamic = "force-dynamic";

const STEP_LABEL: Record<string, { label: string; tone: string }> = {
  ASSIGNED: { label: "À confirmer", tone: "text-xd-text-3" },
  CONFIRMED: { label: "À venir", tone: "text-xd-text-3" },
  EN_ROUTE: { label: "En route", tone: "text-xd-purple-bright" },
  ARRIVED: { label: "Photos avant", tone: "text-xd-warn" },
  PHOTOS_BEFORE: { label: "Prêt à démarrer", tone: "text-xd-warn" },
  IN_PROGRESS: { label: "En cours", tone: "text-xd-purple-bright" },
  PHOTOS_AFTER: { label: "Photos après", tone: "text-xd-warn" },
  PAYMENT: { label: "À encaisser", tone: "text-xd-warn" },
  COMPLETED: { label: "Terminé", tone: "text-xd-ok" },
  NO_SHOW: { label: "Client absent", tone: "text-xd-danger" },
};

async function today(): Promise<{ start: Date; end: Date }> {
  const now = new Date();
  return { start: startOfLocalDay(now), end: endOfLocalDay(now) };
}

export default async function ProAgendaPage() {
  const operator = await requireOperator();
  const { start, end } = await today();

  const appointments = await prisma.appointment.findMany({
    where: {
      operatorId: operator.operatorId,
      scheduledStart: { gte: start, lt: end },
      status: { notIn: ["CANCELLED", "DRAFT", "PENDING_ASSIGNMENT"] },
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      customer: { select: { firstName: true, lastName: true, companyName: true } },
      service: { select: { name: true } },
    },
  });

  const done = appointments.filter((a) => a.status === "COMPLETED").length;
  const revenue = appointments
    .filter((a) => a.status === "COMPLETED")
    .reduce((sum, a) => sum + a.totalCents, 0);

  const next = appointments.find((a) => !["COMPLETED", "NO_SHOW"].includes(a.status));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h2 text-xd-text">Ma journée</h1>
        {/*
          §3.2 — trois tuiles pour trois nombres qu'une phrase porte aussi bien.
          L'opérateur est debout dehors : ce qu'il veut lire tient en une ligne.
        */}
        <p className="mt-1 text-meta text-xd-text-3">
          <span className="first-letter:uppercase">{formatLocalDate(start)}</span>
          {" · "}
          {appointments.length} prestation{appointments.length > 1 ? "s" : ""}
          {done > 0 && ` · ${done} terminée${done > 1 ? "s" : ""}`}
          {revenue > 0 && ` · ${formatEuros(revenue)} encaissés`}
        </p>
      </header>

      {appointments.length === 0 ? (
        <p className="rounded-[--radius-xd-lg] px-4 py-14 text-center text-body text-xd-text-3 m-polished">
          Aucune prestation aujourd&apos;hui.
        </p>
      ) : (
        <ol className="space-y-3">
          {appointments.map((appointment) => {
            const step = STEP_LABEL[appointment.status] ?? { label: appointment.status, tone: "text-xd-text-3" };
            const name =
              appointment.customer.companyName ??
              `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim();
            const settled = ["COMPLETED", "NO_SHOW"].includes(appointment.status);
            // §30 : une seule prestation en avant à la fois — celle qu'il faut faire
            // maintenant. Les autres attendent leur tour sans se disputer l'attention.
            const isNext = appointment.id === next?.id;

            return (
              <li key={appointment.id}>
                <Link
                  href={`/pro/${appointment.id}`}
                  className={`press block rounded-[--radius-xd-lg] p-4 transition-all duration-200 ${
                    isNext ? "m-purple" : settled ? "m-graphite opacity-60" : "m-polished"
                  }`}
                >
                  {isNext && (
                    <p className="eyebrow mb-2 text-xd-purple-bright">
                      {settled ? "Prochaine" : "À faire maintenant"}
                    </p>
                  )}

                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular text-h3 font-semibold text-xd-text">
                      {formatLocalTime(appointment.scheduledStart)}
                    </span>
                    <span className={`text-meta font-medium ${step.tone}`}>{step.label}</span>
                  </div>

                  <p className="mt-2 text-body font-semibold text-xd-text">{name}</p>
                  <p className="mt-0.5 text-meta text-xd-text-3">
                    {appointment.service.name} · {appointment.durationMin} min
                  </p>
                  <p className="mt-1 text-meta text-xd-text-3">
                    {appointment.addressLine1}, {appointment.city}
                  </p>

                  <p className="tabular hairline-t mt-3 pt-3 text-right text-body font-semibold text-xd-text">
                    {formatEuros(appointment.totalCents)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
