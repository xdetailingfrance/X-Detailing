import { BUSINESS, mapEmbedUrl, reviewUrl } from "@/lib/business";

/**
 * Nous trouver — la fiche Google, et les deux gestes qui comptent pour une
 * entreprise locale : laisser un avis, ouvrir la fiche.
 *
 * Aucune adresse n'est affichée : l'entreprise se déplace chez le client, et sa
 * fiche Google n'en montre pas non plus. La carte s'ouvre sur la fiche elle-même.
 */
export function Carte() {
  return (
    <section id="nous-trouver" className="scroll-mt-20 border-t border-black/[0.07]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
          <div>
            <p className="eyebrow text-xd-violet-deep">Nous trouver</p>
            <h2 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
              Nous venons à vous, partout autour de Bordeaux.
            </h2>
            <p className="mt-4 leading-relaxed text-xd-text-2">
              Chez vous ou sur votre lieu de travail, avec l&apos;eau et le matériel.
              Zone d&apos;intervention : {BUSINESS.area}.
            </p>
            <p className="mt-3 text-sm text-xd-text-3">
              Les avis et les photos de nos réalisations sont sur notre fiche Google.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={reviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
                </svg>
                Laisser un avis
              </a>
              <a
                href={BUSINESS.google.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.6" />
                </svg>
                Nous trouver
              </a>
            </div>
          </div>

          <div className="card overflow-hidden rounded-xd-xl">
            <iframe
              src={mapEmbedUrl()}
              title={`Fiche Google — ${BUSINESS.name}`}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="block h-[320px] w-full border-0 sm:h-[380px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
