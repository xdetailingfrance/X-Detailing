import Link from "next/link";
import { prisma } from "@/server/db";
import { BUSINESS, siteUrl } from "@/lib/business";
import { JsonLd } from "@/lib/structured-data";
import { formatDuration, formatLocalDate } from "@/server/time";
import { REQUIRED_SLOTS } from "@/server/workflow/types";

/**
 * Les réalisations (§29).
 *
 * Chaque prestation terminée dont le client a accepté la publication devient une étude
 * de cas : véhicule, formule, durée réelle, photos avant et après. Rien n'est rédigé —
 * c'est le travail fait qui s'affiche.
 *
 * La liste n'existe que par l'accord des clients. Sans accord, elle reste vide et le dit.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Nos réalisations — avant / après · ${BUSINESS.name}`,
  description:
    "Les véhicules que nous avons traités, avec les photos prises à l'arrivée et au " +
    "départ, la formule retenue et la durée réelle de l'intervention.",
  alternates: { canonical: "/realisations" },
};

export default async function RealisationsPage() {
  const jobs = await prisma.appointment.findMany({
    where: { status: "COMPLETED", publishable: true, photos: { some: {} } },
    orderBy: { finishedAt: "desc" },
    take: 24,
    select: {
      reference: true,
      city: true,
      durationMin: true,
      finishedAt: true,
      scheduledStart: true,
      service: { select: { name: true } },
      customerVehicle: { select: { make: true, model: true, vehicleClass: true } },
      photos: { select: { id: true, phase: true, slot: true } },
    },
  });

  const cards = jobs
    .map((job) => ({
      ...job,
      cover: job.photos.find((p) => p.phase === "AFTER" && p.slot === REQUIRED_SLOTS[0])
        ?? job.photos.find((p) => p.phase === "AFTER"),
    }))
    .filter((job) => job.cover);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl()}/` },
              { "@type": "ListItem", position: 2, name: "Réalisations", item: `${siteUrl()}/realisations` },
            ],
          },
        ]}
      />

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:pt-32">
        <h1 className="eyebrow text-xd-violet-highlight">
          Réalisations à {BUSINESS.city}
        </h1>
        <p className="mt-5 max-w-2xl text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.035em] text-xd-text sm:text-[3rem]">
          Les véhicules qu&apos;on a traités.
        </p>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-xd-text-2">
          Photos prises à l&apos;arrivée et au départ par l&apos;opérateur, sur place.
          Durées réelles. Publié avec l&apos;accord des clients.
        </p>

        {cards.length === 0 ? (
          <div className="glass mt-12 rounded-[--radius-xd-2xl] px-6 py-14 text-center sm:px-10">
            <p className="mx-auto max-w-md text-body text-xd-text-2">
              Aucune réalisation publiée pour l&apos;instant.
            </p>
            <p className="mx-auto mt-3 max-w-lg text-meta leading-relaxed text-xd-text-4">
              Les prestations terminées s&apos;afficheront ici dès qu&apos;un client aura
              accepté que les photos de son véhicule soient montrées.
            </p>
          </div>
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((job) => {
              const vehicle = [job.customerVehicle?.make, job.customerVehicle?.model]
                .filter(Boolean)
                .join(" ");
              return (
                <li key={job.reference}>
                  <Link
                    href={`/realisations/${job.reference}`}
                    className="glass glass-interactive press block overflow-hidden rounded-[--radius-xd-xl]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${job.cover!.id}`}
                      alt={`${vehicle || "Véhicule"} après ${job.service.name.toLowerCase()} — ${BUSINESS.name} à ${job.city}`}
                      width={320}
                      height={240}
                      loading="lazy"
                      className="aspect-[4/3] w-full bg-xd-graphite object-cover"
                    />
                    <div className="px-5 py-4">
                      <p className="text-body font-semibold text-xd-text">
                        {vehicle || "Véhicule"}
                      </p>
                      <p className="mt-1 text-meta text-xd-text-3">
                        {job.service.name} · {formatDuration(job.durationMin)} · {job.city}
                      </p>
                      <p className="mt-0.5 text-micro text-xd-text-4">
                        {formatLocalDate(job.finishedAt ?? job.scheduledStart)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
