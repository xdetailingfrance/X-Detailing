import Image from "next/image";
import { BUSINESS, realValue, telHref } from "@/lib/business";
import { JsonLd, localBusinessSchema } from "@/lib/schema";
import { Hero } from "@/components/hero";
import { Devis } from "@/components/devis";
import { Carte } from "@/components/carte";
import { Footer } from "@/components/footer";

/**
 * Le site tient sur cette page.
 *
 * Dans l'ordre : la promesse, le formulaire de réservation, les deux formules avec
 * leur contenu et les options, la carte, les informations. Pas de menu : il n'y a
 * nulle part ailleurs où aller.
 *
 * La page est générée au déploiement et servie telle quelle ; seuls les créneaux
 * libres sont lus en base, au moment où le visiteur les choisit. Les réservations
 * partent par e-mail.
 */

export const metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const phone = realValue(BUSINESS.phone);
  const tel = telHref();

  return (
    <>
      <JsonLd data={[localBusinessSchema()]} />

      <header className="hairline-b sticky top-0 z-40 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
          <a
            href="#"
            aria-label={`${BUSINESS.name} — haut de page`}
            className="flex items-center gap-2.5"
          >
            <Image
              src="/marque/x-mark.png"
              alt=""
              width={512}
              height={364}
              priority
              className="h-6 w-auto"
            />
            <span className="eyebrow text-xd-text-2">Detailing</span>
          </a>

          <div className="flex items-center gap-2">
            {tel && phone && (
              <a href={tel} className="btn btn-secondary btn-sm tabular hidden sm:inline-flex">
                {phone}
              </a>
            )}
            <a href="#reserver" className="btn btn-primary btn-sm">
              Réserver
            </a>
          </div>
        </div>
      </header>

      <main>
        <Hero />
        <Devis />
        <Carte />
      </main>

      <Footer />
    </>
  );
}
