import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/db";
import { BUSINESS, siteUrl } from "@/lib/business";
import { JsonLd } from "@/lib/structured-data";
import { formatDuration, formatLocalDate } from "@/server/time";
import { REQUIRED_SLOTS, SLOT_LABEL } from "@/server/workflow/types";

/**
 * Une réalisation (§29).
 *
 * Étude de cas minuscule et entièrement factuelle : le véhicule, la formule, ce qui a
 * été fait, le temps que ça a pris, et les seize photos. Aucune prose commerciale — la
 * comparaison avant/après se suffit.
 *
 * L'accord de publication conditionne l'accès : sans lui la page n'existe pas, et les
 * photos restent derrière l'authentification.
 */

export const dynamic = "force-dynamic";

async function loadJob(reference: string) {
  return prisma.appointment.findFirst({
    where: { reference, status: "COMPLETED", publishable: true },
    select: {
      reference: true,
      city: true,
      durationMin: true,
      startedAt: true,
      finishedAt: true,
      scheduledStart: true,
      vehicleClass: true,
      service: { select: { name: true, slug: true, includes: true } },
      customerVehicle: { select: { make: true, model: true } },
      options: { select: { option: { select: { name: true } } } },
      photos: { select: { id: true, phase: true, slot: true } },
      review: { select: { rating: true, comment: true } },
    },
  });
}

export async function generateMetadata({ params }: PageProps<"/realisations/[reference]">) {
  const { reference } = await params;
  const job = await loadJob(reference);
  if (!job) return {};

  const vehicle = [job.customerVehicle?.make, job.customerVehicle?.model]
    .filter(Boolean)
    .join(" ") || "Véhicule";

  return {
    title: `${vehicle} — ${job.service.name} à ${job.city} · ${BUSINESS.name}`,
    description: `${job.service.name} réalisé sur ${vehicle} à ${job.city}. ${formatDuration(job.durationMin)} d'intervention, photos avant et après.`,
    alternates: { canonical: `/realisations/${job.reference}` },
  };
}

export default async function RealisationPage({
  params,
}: PageProps<"/realisations/[reference]">) {
  const { reference } = await params;
  const job = await loadJob(reference);
  if (!job) notFound();

  const vehicle =
    [job.customerVehicle?.make, job.customerVehicle?.model].filter(Boolean).join(" ") ||
    "Véhicule";

  /** Les photos dans l'ordre du tour du véhicule, appariées avant / après. */
  const pairs = REQUIRED_SLOTS.map((slot) => ({
    slot,
    label: SLOT_LABEL[slot],
    before: job.photos.find((p) => p.phase === "BEFORE" && p.slot === slot),
    after: job.photos.find((p) => p.phase === "AFTER" && p.slot === slot),
  })).filter((pair) => pair.before || pair.after);

  const realDuration =
    job.startedAt && job.finishedAt
      ? Math.round((job.finishedAt.getTime() - job.startedAt.getTime()) / 60_000)
      : job.durationMin;

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
              { "@type": "ListItem", position: 3, name: vehicle, item: `${siteUrl()}/realisations/${job.reference}` },
            ],
          },
        ]}
      />

      <article className="mx-auto max-w-5xl px-5 pb-20 pt-28 sm:pt-32">
        <nav aria-label="Fil d'Ariane" className="text-meta text-xd-text-4">
          <Link href="/" className="transition-colors hover:text-xd-text-2">Accueil</Link>
          <span className="mx-2">/</span>
          <Link href="/realisations" className="transition-colors hover:text-xd-text-2">
            Réalisations
          </Link>
        </nav>

        <h1 className="mt-8 text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.035em] text-xd-text sm:text-[2.8rem]">
          {vehicle}
        </h1>
        <p className="mt-3 text-body text-xd-text-3">
          <Link
            href={`/${job.service.slug}`}
            className="text-xd-text-2 underline decoration-white/20 underline-offset-4 transition-colors hover:text-xd-text"
          >
            {job.service.name}
          </Link>
          {" · "}
          {job.city}
          {" · "}
          {formatLocalDate(job.finishedAt ?? job.scheduledStart)}
        </p>

        {/* ── Les faits ───────────────────────────────────────────────────── */}
        <dl className="mt-10 grid gap-px overflow-hidden rounded-[--radius-xd-xl] bg-black/[0.05] sm:grid-cols-3">
          <div className="bg-xd-carbon px-5 py-5">
            <dt className="eyebrow text-xd-text-4">Temps sur place</dt>
            <dd className="tabular mt-1.5 text-h2 font-semibold tracking-[-0.025em] text-xd-text">
              {formatDuration(realDuration)}
            </dd>
          </div>
          <div className="bg-xd-carbon px-5 py-5">
            <dt className="eyebrow text-xd-text-4">Photos de preuve</dt>
            <dd className="tabular mt-1.5 text-h2 font-semibold tracking-[-0.025em] text-xd-text">
              {job.photos.length}
            </dd>
          </div>
          <div className="bg-xd-carbon px-5 py-5">
            <dt className="eyebrow text-xd-text-4">Options ajoutées</dt>
            <dd className="mt-1.5 text-h2 font-semibold tracking-[-0.025em] text-xd-text">
              {job.options.length > 0 ? job.options.length : "—"}
            </dd>
          </div>
        </dl>

        {job.options.length > 0 && (
          <p className="mt-4 text-meta text-xd-text-3">
            {job.options.map((o) => o.option.name).join(" · ")}
          </p>
        )}

        {/* ── Avant / après ───────────────────────────────────────────────── */}
        <h2 className="mt-16 text-[1.8rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
          Avant, puis après.
        </h2>
        <p className="mt-3 max-w-xl text-body text-xd-text-3">
          Mêmes angles, même endroit, à quelques heures d&apos;intervalle. C&apos;est la
          comparaison qui prouve le travail, pas une photo isolée.
        </p>

        <div className="mt-8 space-y-10">
          {pairs.map((pair) => (
            <section key={pair.slot}>
              <h3 className="eyebrow text-xd-violet-highlight">{pair.label}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { photo: pair.before, caption: "Avant" },
                  { photo: pair.after, caption: "Après" },
                ].map(({ photo, caption }) => (
                  <figure key={caption} className="glass overflow-hidden rounded-[--radius-xd-lg]">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={`${vehicle} — ${pair.label}, ${caption.toLowerCase()} ${job.service.name.toLowerCase()} par ${BUSINESS.name} à ${job.city}`}
                        width={320}
                        height={240}
                        loading="lazy"
                        className="aspect-[4/3] w-full bg-xd-graphite object-cover"
                      />
                    ) : (
                      <div className="grid aspect-[4/3] place-items-center text-meta text-xd-text-4">
                        Photo absente
                      </div>
                    )}
                    <figcaption className="px-4 py-2.5 text-meta text-xd-text-3">
                      {caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ── Ce qui a été fait ───────────────────────────────────────────── */}
        <h2 className="mt-16 text-[1.8rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
          Ce qui a été fait.
        </h2>
        <ul className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {job.service.includes.map((item) => (
            <li key={item} className="flex gap-3 text-body text-xd-text-2">
              <span aria-hidden className="mt-[10px] size-1 shrink-0 rounded-full bg-xd-violet-highlight" />
              {item}
            </li>
          ))}
        </ul>

        {job.review?.comment && (
          <blockquote className="glass-premium mt-12 rounded-[--radius-xd-xl] p-7">
            <p aria-label={`${job.review.rating} sur 5`} className="text-meta text-xd-warn">
              {"★".repeat(job.review.rating)}
              <span className="text-xd-text-4">{"★".repeat(5 - job.review.rating)}</span>
            </p>
            <p className="mt-3 text-body leading-relaxed text-xd-text-2">
              « {job.review.comment} »
            </p>
          </blockquote>
        )}

        <div className="mt-14 flex flex-wrap gap-3">
          <Link
            href={`/reserver?vehicule=${job.vehicleClass}`}
            className="press rounded-full bg-xd-violet px-7 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight"
          >
            Réserver la même prestation
          </Link>
          <Link
            href="/realisations"
            className="glass glass-interactive press rounded-full px-7 py-3.5 text-body font-medium text-xd-text"
          >
            Voir d&apos;autres véhicules
          </Link>
        </div>
      </article>
    </>
  );
}
