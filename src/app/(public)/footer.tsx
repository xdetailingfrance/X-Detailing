import Link from "next/link";
import { BUSINESS, realValue, telHref } from "@/lib/business";

/**
 * Fermeture de l'expérience (§27).
 *
 * Une dernière invitation, puis les informations. Pas six colonnes de liens : le pied de
 * page sert au référencement local et à joindre l'entreprise, ce qui tient en peu de
 * lignes si elles sont les bonnes.
 *
 * Les coordonnées viennent de `BUSINESS`, source unique : c'est la cohérence NAP que
 * Google Local recoupe entre le site, la fiche et les annuaires.
 */
export function Footer({ sectors }: { sectors: string[] }) {
  const phone = realValue(BUSINESS.phone);
  const tel = telHref();
  const email = realValue(BUSINESS.email);

  return (
    <footer className="border-t border-black/[0.08]">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <p className="max-w-xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
          Votre prochaine voiture propre commence ici.
        </p>
        <Link
          href="/reserver"
          className="press mt-7 inline-flex rounded-full bg-xd-violet px-7 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight"
        >
          Choisir un créneau
        </Link>

        <div className="mt-16 grid gap-8 border-t border-black/[0.08] pt-10 text-meta sm:grid-cols-3">
          <div>
            <p className="font-semibold text-xd-text">{BUSINESS.name}</p>
            <p className="mt-2 max-w-xs leading-relaxed text-xd-text-3">{BUSINESS.summary}</p>
          </div>

          <div className="space-y-1.5 text-xd-text-3">
            <p className="eyebrow mb-3 text-xd-text-4">Nous joindre</p>
            {tel && phone ? (
              <p>
                <a href={tel} className="transition-colors hover:text-xd-text">
                  {phone}
                </a>
              </p>
            ) : (
              <p className="text-xd-text-4">{BUSINESS.phone}</p>
            )}
            {email ? (
              <p>
                <a href={`mailto:${email}`} className="transition-colors hover:text-xd-text">
                  {email}
                </a>
              </p>
            ) : (
              <p className="text-xd-text-4">{BUSINESS.email}</p>
            )}
            <p className="text-xd-text-4">
              {BUSINESS.address.street}, {BUSINESS.address.postalCode} {BUSINESS.address.city}
            </p>
            <p className="text-xd-text-4">
              Horaires : {BUSINESS.openingHours ? "" : "[HORAIRES]"}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="eyebrow mb-3 text-xd-text-4">Zone d&apos;intervention</p>
            {sectors.length > 0 ? (
              <p className="leading-relaxed text-xd-text-3">{sectors.join(" · ")}</p>
            ) : (
              <p className="text-xd-text-4">{BUSINESS.area}</p>
            )}
            <p className="pt-3">
              <Link href="/espace" className="text-xd-text-3 transition-colors hover:text-xd-text">
                Suivre mon rendez-vous
              </Link>
            </p>
            <p>
              <Link href="/connexion" className="text-xd-text-4 transition-colors hover:text-xd-text-2">
                Espace opérateur
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-10 text-micro text-xd-text-4">
          © {new Date().getFullYear()} {BUSINESS.name} · {BUSINESS.legalName} · Mentions
          légales [À RÉDIGER]
        </p>
      </div>
    </footer>
  );
}
