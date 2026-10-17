import { BUSINESS } from "@/lib/business";
import { euros, prixMinimum } from "@/lib/catalogue";
import { CRENEAUX, libelleHeure } from "@/lib/creneaux";

/**
 * Premier écran — une promesse, un prix, un bouton.
 *
 * Le H1 est la requête que quelqu'un tape réellement dans Google ; la phrase en
 * dessous est celle qu'il lit. Tout ce qui ne mène pas au devis a été retiré.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Lumière violette très diffuse, posée en haut : une signature, pas un décor. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_44%_at_50%_-10%,rgb(123_60_255/0.12),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-3xl px-5 pb-10 pt-14 text-center sm:pb-14 sm:pt-20">
        <h1 className="eyebrow text-xd-violet-deep">
          Lavage et detailing automobile à {BUSINESS.city}
        </h1>

        <p className="mt-5 text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.035em] text-xd-text sm:text-[3.4rem]">
          Votre voiture, propre
          <br className="hidden sm:block" /> comme au premier jour.
        </p>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-xd-text-2">
          Nettoyage intérieur, ou intérieur et extérieur, réalisé par un professionnel
          qui vient à vous : chez vous ou sur votre lieu de travail, à Bordeaux et dans
          ses alentours. Le tarif est annoncé à l&apos;avance et confirmé avant
          l&apos;intervention.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href="#reserver" className="btn btn-primary w-full sm:w-auto">
            Réserver mon créneau
          </a>
          <a href="#formules" className="btn btn-secondary w-full sm:w-auto">
            Voir les formules · dès {euros(prixMinimum("interieur"))}
          </a>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-xd-text-3">
          <li>Deux formules, un prix ferme</li>
          <li>Trois créneaux par jour : {CRENEAUX.map(libelleHeure).join(", ")}</li>
          <li>{BUSINESS.area}</li>
        </ul>
      </div>
    </section>
  );
}
