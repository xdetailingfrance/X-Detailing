import Link from "next/link";
import { ApplicationForm } from "./form";

/**
 * Page de candidature (§9).
 *
 * Même charte que la landing, même en-tête, mais **sans le bouton fixe** : on y est
 * déjà. Un bouton qui renvoie vers la page où l'on se trouve est un bruit.
 */

export const metadata = {
  title: "Candidature — devenir opérateur X Detailing",
  description:
    "Déposez votre candidature pour rejoindre le réseau X Detailing : lavage " +
    "automobile mobile, calendrier rempli, lancement accompagné.",
  alternates: { canonical: "/candidature" },
  robots: { index: false, follow: true },
};

export default function CandidaturePage() {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#1c1c25] bg-[rgb(7_7_10_/_0.94)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[560px] items-center justify-between px-5">
          <Link href="/devenir-operateur" className="flex items-baseline gap-1.5" aria-label="X Detailing">
            <span className="lp-display text-[26px] font-bold leading-none text-[color:var(--lp-logo-x)]">
              X
            </span>
            <span className="lp-display text-[13px] font-medium uppercase leading-none tracking-[0.32em] text-[color:var(--lp-logo-word)]">
              Detailing
            </span>
          </Link>
          <Link
            href="/devenir-operateur"
            className="text-[14px] text-[color:var(--lp-body)] transition-colors hover:text-[color:var(--lp-text)]"
          >
            ← Retour
          </Link>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div aria-hidden className="lp-halo-top pointer-events-none absolute inset-x-0 top-0 h-[300px]" />
        <div className="relative mx-auto max-w-[560px] px-5 pb-20 pt-10">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[color:var(--lp-accent)]">
            Candidature
          </p>
          <h1 className="lp-display mt-4 text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--lp-title)]">
            Développez votre propre activité.
          </h1>
          <p className="mt-4 text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
            Quelques minutes suffisent. Si votre profil correspond, nous vous rappelons
            pour en parler.
          </p>

          <div className="mt-9">
            <ApplicationForm />
          </div>
        </div>
      </main>
    </>
  );
}
