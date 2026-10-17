import Image from "next/image";
import { BUSINESS, realValue, reviewUrl, telHref } from "@/lib/business";

/**
 * Pied de page — les informations, et rien d'autre.
 *
 * Les coordonnées viennent de `BUSINESS`, source unique : c'est la cohérence
 * nom / adresse / téléphone que Google recoupe entre le site et la fiche.
 * Les mentions légales tiennent dans un bloc dépliable : un one-page n'a pas de
 * page à leur consacrer, et la loi demande les informations, pas une page.
 */
export function Footer() {
  const phone = realValue(BUSINESS.phone);
  const tel = telHref();
  const email = realValue(BUSINESS.email);

  return (
    <footer className="border-t border-black/[0.08] bg-xd-bg-2">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
        <div className="grid gap-10 text-sm sm:grid-cols-3">
          <div>
            <a href="#" aria-label="Haut de page" className="inline-flex items-center gap-2.5">
              <Image src="/marque/x-mark.png" alt="" width={512} height={364} className="h-6 w-auto" />
              <span className="eyebrow text-xd-text-2">Detailing</span>
            </a>
            <p className="mt-4 max-w-xs leading-relaxed text-xd-text-3">{BUSINESS.summary}</p>
          </div>

          <div className="space-y-1.5 text-xd-text-3">
            <p className="eyebrow mb-3 text-xd-text-4">Nous joindre</p>
            {tel && phone && (
              <p>
                <a href={tel} className="transition-colors hover:text-xd-text">
                  {phone}
                </a>
              </p>
            )}
            {email && (
              <p>
                <a href={`mailto:${email}`} className="transition-colors hover:text-xd-text">
                  {email}
                </a>
              </p>
            )}
            <p>
              <a href="#reserver" className="transition-colors hover:text-xd-text">
                Par le formulaire de réservation
              </a>
            </p>
          </div>

          <div className="space-y-1.5 text-xd-text-3">
            <p className="eyebrow mb-3 text-xd-text-4">Zone d&apos;intervention</p>
            <p className="leading-relaxed">{BUSINESS.area}</p>
            <p className="pt-3">
              <a href="#reserver" className="transition-colors hover:text-xd-text">
                Réserver un créneau
              </a>
            </p>
            <p>
              <a
                href={reviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-xd-text"
              >
                Laisser un avis Google
              </a>
            </p>
          </div>
        </div>

        <details className="mt-12 text-sm text-xd-text-3">
          <summary className="cursor-pointer select-none font-medium text-xd-text-2">
            Mentions légales
          </summary>
          <div className="mt-3 max-w-2xl space-y-2 leading-relaxed">
            <p>
              Éditeur : {BUSINESS.legalName}, {BUSINESS.legalForm}, SIREN {BUSINESS.siren}.
              Siège social : {BUSINESS.siege}.{phone ? ` Téléphone : ${phone}.` : ""}
            </p>
            <p>
              Hébergement : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723,
              États-Unis.
            </p>
            <p>
              Données personnelles : les informations saisies dans le formulaire servent
              uniquement à traiter votre réservation et à vous recontacter. Elles ne sont
              ni cédées ni utilisées à d&apos;autres fins. Vous pouvez en demander la
              consultation ou la suppression en nous écrivant.
            </p>
          </div>
        </details>

        <p className="mt-8 text-xs text-xd-text-4">
          © {new Date().getFullYear()} {BUSINESS.legalName} · {BUSINESS.legalForm} · SIREN{" "}
          {BUSINESS.siren}
        </p>
      </div>
    </footer>
  );
}
