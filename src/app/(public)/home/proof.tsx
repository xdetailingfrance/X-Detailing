import Link from "next/link";
import { formatLocalDate } from "@/server/time";

/**
 * Preuve (§8, expériences 03 et 07).
 *
 * Deux preuves de nature différente : ce que les clients ont écrit, et ce que les photos
 * montrent. Aucune des deux n'est fabriquée — les avis viennent de la base, les
 * transformations viendront des prestations réellement réalisées.
 *
 * L'avant/après attend deux choses qui n'existent pas encore : des photos publiables, et
 * le consentement du client pour les publier. Une photo de véhicule devant un domicile,
 * plaque comprise, ne se met pas en ligne parce qu'elle est belle. Le bloc dit ce qui
 * manque plutôt que d'afficher des images de synthèse.
 */

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  firstName: string;
  createdAt: Date;
  serviceName: string;
  city: string;
};

export function Proof({ reviews }: { reviews: PublicReview[] }) {
  return (
    <section id="avant-apres" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 sm:py-20">
      <h2 className="text-center text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
        Les transformations.
      </h2>

      <p className="mx-auto mt-3 max-w-lg text-center text-body text-xd-text-3">
        Chaque véhicule traité a sa page : les huit angles à l&apos;arrivée, les huit
        mêmes au départ, la durée réelle. Publié avec l&apos;accord du client.
      </p>
      <div className="mt-7 text-center">
        <Link
          href="/realisations"
          className="glass glass-interactive press inline-flex rounded-full px-7 py-3.5 text-body font-medium text-xd-text"
        >
          Voir les réalisations
        </Link>
      </div>

      {/* ── Avis ────────────────────────────────────────────────────────── */}
      {reviews.length > 0 ? (
        <>
          <h3 className="mt-16 text-center text-h2 font-semibold tracking-[-0.02em] text-xd-text">
            Ce qu&apos;ils en disent.
          </h3>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="glass glass-interactive flex flex-col rounded-[--radius-xd-xl] p-6"
              >
                <p aria-label={`${review.rating} sur 5`} className="text-meta text-xd-warn">
                  {"★".repeat(review.rating)}
                  <span className="text-xd-text-4">{"★".repeat(5 - review.rating)}</span>
                </p>
                {review.comment && (
                  <p className="mt-3 flex-1 text-body leading-relaxed text-xd-text-2">
                    « {review.comment} »
                  </p>
                )}
                <p className="mt-4 text-meta text-xd-text-4">
                  {review.firstName} · {review.serviceName} · {review.city}
                  <span className="mt-0.5 block">{formatLocalDate(review.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
