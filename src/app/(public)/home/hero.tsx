import Link from "next/link";
import { BUSINESS, realValue } from "@/lib/business";

/**
 * Premier écran (§8, expérience 01).
 *
 * Trois choses doivent être comprises avant tout défilement : ce qu'est X Detailing,
 * où l'entreprise intervient, et comment réserver. Le reste du hero sert la première
 * impression, pas la compréhension.
 *
 * Le H1 porte la formulation utile au référencement local ; la grande phrase, elle,
 * s'adresse au lecteur. Les deux cohabitent sans se disputer la hiérarchie : l'un est
 * l'étiquette de la page, l'autre en est l'accroche.
 */

/** Ce que le regard parcourt sur un véhicule, annoté autour de la photo. */
const SCAN_POINTS = [
  { label: "Carrosserie", top: "22%", left: "16%", align: "left" as const },
  { label: "Jantes", top: "72%", left: "24%", align: "left" as const },
  { label: "Intérieur", top: "34%", left: "78%", align: "right" as const },
  { label: "Finition", top: "62%", left: "82%", align: "right" as const },
];

export function Hero() {
  const rating = realValue(BUSINESS.google.rating);
  const reviewCount = realValue(BUSINESS.google.reviewCount);

  return (
    <section className="relative overflow-hidden">
      {/*
        Lumière de studio dirigée depuis le haut-gauche. Pas de nappe violette centrée :
        c'est la signature visuelle des applications crypto, et elle écrase le sujet.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_52%_at_14%_-6%,rgb(123_60_255/0.15),transparent_68%)]"
      />
      {/* Ligne d'arête violette en bas de section : une découpe, pas un dégradé. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgb(123_60_255/0.4),transparent)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-28 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-36">
        <div className="max-w-xl">
          {/* H1 : ce que cherche quelqu'un qui tape sa requête. */}
          <h1 className="eyebrow text-xd-violet-highlight">
            Lavage et detailing automobile à {BUSINESS.city}
          </h1>

          <p className="mt-5 text-[2.6rem] font-semibold leading-[1.03] tracking-[-0.035em] text-xd-text sm:text-[3.4rem] lg:text-[3.9rem]">
            Votre voiture.
            <br />
            Lavée là où elle est garée.
          </p>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-xd-text-2">
            Un opérateur vient chez vous ou sur votre lieu de travail, avec son eau et son
            matériel. Vous n&apos;avez rien à prévoir, rien à déplacer.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="#besoin"
              className="press rounded-full bg-xd-violet px-7 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight"
            >
              Choisir mon nettoyage
            </Link>
            <Link
              href="#avant-apres"
              className="glass glass-interactive press rounded-full px-7 py-3.5 text-body font-medium text-xd-text"
            >
              Voir les transformations
            </Link>
          </div>

          {/*
            Preuve immédiate. Elle n'apparaît que si la note Google est réellement
            renseignée : une note inventée sous un bouton de réservation est exactement
            le genre de détail qui se retourne contre l'entreprise.
          */}
          {rating && reviewCount ? (
            <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-xd-text-3">
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

        {/* ── Le véhicule ───────────────────────────────────────────────── */}
        <div className="relative">
          <div className="glass-premium relative aspect-[4/3] overflow-hidden rounded-[--radius-xd-2xl]">
            {/*
              Emplacement photo. Tant qu'une vraie image X Detailing n'est pas fournie,
              on affiche ce qu'il faut livrer plutôt qu'une berline de banque d'images :
              une voiture générique dans un parking sombre dit au visiteur que
              l'entreprise n'a rien à montrer.
            */}
            <div className="absolute inset-0 grid place-items-center px-8 text-center">
              <div>
                <p className="text-meta font-medium text-xd-text-3">
                  Photo d&apos;un véhicule réellement traité
                </p>
                <p className="mx-auto mt-2 max-w-xs text-micro leading-relaxed text-xd-text-4">
                  Trois quarts avant, fond sombre, carrosserie propre et réfléchissante.
                  Format 4:3, 1600 px de large minimum.
                </p>
              </div>
            </div>

            {/* Annotations. Fines, discontinues, sans halo : un relevé, pas un HUD de jeu. */}
            {SCAN_POINTS.map((point) => (
              <div
                key={point.label}
                aria-hidden
                className="absolute flex items-center gap-2"
                style={{
                  top: point.top,
                  left: point.left,
                  transform: point.align === "right" ? "translateX(-100%)" : undefined,
                  flexDirection: point.align === "right" ? "row-reverse" : "row",
                }}
              >
                <span className="size-1 rounded-full bg-xd-violet-highlight" />
                <span className="h-px w-6 bg-[linear-gradient(90deg,rgb(157_107_255/0.6),transparent)]" />
                <span className="text-micro uppercase tracking-[0.14em] text-xd-text-3">
                  {point.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
