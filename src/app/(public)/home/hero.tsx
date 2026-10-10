import Link from "next/link";
import { BUSINESS, realValue } from "@/lib/business";

/**
 * Premier écran — une promesse, un prix, un bouton.
 *
 * Une page de capture n'a pas à être une page de marque. Tout ce qui ne mène pas
 * au créneau a été retiré : il n'y a plus de visuel d'attente, plus d'annotations
 * autour d'une photo absente, plus de second axe de lecture. Le visiteur descend
 * vers l'offre ou clique.
 */
export function Hero({ fromPriceCents }: { fromPriceCents: number | null }) {
  const rating = realValue(BUSINESS.google.rating);
  const reviewCount = realValue(BUSINESS.google.reviewCount);
  const euros = (cents: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

  return (
    <section className="relative overflow-hidden">
      {/* Lumière violette très diffuse, posée en haut : une signature, pas un décor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_44%_at_50%_-10%,rgb(123_60_255/0.1),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-28 text-center sm:pt-32 lg:pb-20 lg:pt-36">
        {/* H1 : la requête que quelqu'un tape réellement. */}
        <h1 className="eyebrow text-xd-violet-highlight">
          Lavage et detailing automobile à {BUSINESS.city}
        </h1>

        <p className="mt-5 text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] text-xd-text sm:text-[3.4rem]">
          Votre voiture, lavée
          <br className="hidden sm:block" /> là où elle est garée.
        </p>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-xd-text-2">
          Un opérateur vient chez vous ou sur votre lieu de travail, avec son eau et son
          matériel. Vous n&apos;avez rien à prévoir, rien à déplacer.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/reserver"
            className="press w-full rounded-full bg-xd-violet px-8 py-4 text-body font-semibold text-white transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight sm:w-auto"
          >
            Réserver mon créneau
          </Link>
          <Link
            href="#packs"
            className="glass glass-interactive press w-full rounded-full px-8 py-4 text-body font-medium text-xd-text sm:w-auto"
          >
            {fromPriceCents ? `Voir les tarifs — dès ${euros(fromPriceCents)}` : "Voir les tarifs"}
          </Link>
        </div>

        {/*
          Preuve immédiate, et seulement si elle existe. Une note inventée sous un
          bouton de réservation est exactement le détail qui se retourne contre
          l'entreprise le jour où quelqu'un vérifie.
        */}
        {rating && reviewCount ? (
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-meta text-xd-text-3">
            <span className="text-xd-warn">★★★★★</span>
            <span className="font-medium text-xd-text-2">{rating}</span>
            <span>sur Google · {reviewCount} avis</span>
          </p>
        ) : (
          <p className="mt-6 text-meta text-xd-text-4">
            Note Google : {BUSINESS.google.rating} · {BUSINESS.google.reviewCount} avis
            <span className="ml-2 rounded-full bg-xd-warn/12 px-2 py-0.5 text-micro text-xd-warn">
              à renseigner
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
