import Link from "next/link";
import { LandingHeader, StickyApply } from "./header";
import {
  IconBuilding, IconCalendar, IconCar, IconFlag, IconLayers, IconPlay, IconTruck, IconWallet,
} from "./icons";

/**
 * Landing « Devenir opérateur X Detailing ».
 *
 * Un seul objectif : amener au formulaire de candidature. Tous les chemins y mènent —
 * le bouton fixe, le menu, la section finale.
 *
 * Deux chiffres seulement figurent sur cette page, et chacun porte sa mention : les
 * 7 500 € sont un ordre de grandeur du secteur, pas un résultat du réseau, et les
 * 3 000 € sont sous réserve d'acceptation du dossier. Aucun autre nombre n'est avancé
 * tant qu'il n'y a pas de réseau existant pour l'étayer.
 */

export const metadata = {
  title: "Devenir opérateur X Detailing — lavage auto mobile",
  description:
    "On remplit votre calendrier de rendez-vous : vous n'avez qu'à bichonner les " +
    "voitures de vos clients et assurer vos prestations. Candidatez pour rejoindre le réseau.",
  alternates: { canonical: "/devenir-operateur" },
  openGraph: {
    title: "Devenir opérateur X Detailing — lavage auto mobile",
    description:
      "On remplit votre calendrier de rendez-vous. Vous assurez vos prestations.",
    locale: "fr_FR",
    type: "website",
  },
};

/**
 * Les témoignages restent masqués tant qu'aucun opérateur réel n'a été filmé.
 * Passer à `true` seulement avec de vraies vidéos : on n'invente pas de témoignage.
 */
const SHOW_TESTIMONIALS = true;

/** Illustration d'agenda : 1 = créneau rempli. Décorative, lue par personne. */
const CALENDAR_PATTERN = [
  [1, 1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1, 1],
  [1, 0, 1, 1, 1, 0],
  [1, 1, 1, 0, 1, 1],
];

const DAYS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

const LAUNCH = [
  {
    Icon: IconTruck,
    title: "Votre camion",
    body: "Un camion entièrement aménagé en matériel professionnel, autonome, et floqué aux couleurs X Detailing.",
  },
  {
    Icon: IconBuilding,
    title: "La création d'entreprise",
    body: "On s'occupe de créer votre entreprise.",
  },
  {
    Icon: IconWallet,
    title: "Le financement",
    body: "On s'occupe de votre financement.",
  },
];

const REASONS = [
  { n: "01", title: "Un concept mobile", body: "Pas besoin d'un local commercial classique pour développer son activité." },
  { n: "02", title: "Une image premium", body: "Un véhicule identifiable et une identité visuelle homogène." },
  { n: "03", title: "Des outils digitaux", body: "X Detailing OS pour gérer les prospects, rendez-vous, clients et prestations." },
  { n: "04", title: "Un accompagnement structuré", body: "Formation, lancement commercial et accompagnement dans la mise en place du projet." },
  { n: "05", title: "Un réseau, une vraie famille", body: "Des concours, des événements et un vrai esprit de famille entre opérateurs." },
];

/** Enveloppe de section : mêmes marges partout (20 px), respiration constante. */
function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative ${className}`}>
      <div className="relative mx-auto max-w-[480px] px-5 py-[52px] lg:max-w-[1100px] lg:py-20">
        {children}
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[color:var(--lp-accent)]">
      {children}
    </p>
  );
}

export default function DevenirOperateurPage() {
  return (
    <>
      <LandingHeader showTestimonials={SHOW_TESTIMONIALS} />

      {/* ── 1. Hero + vidéo ─────────────────────────────────────────────── */}
      <section id="video" className="relative overflow-hidden">
        <div aria-hidden className="lp-halo-top pointer-events-none absolute inset-x-0 top-0 h-[360px]" />
        <div className="relative mx-auto max-w-[480px] px-5 pb-12 pt-10 lg:max-w-[1100px] lg:pb-20 lg:pt-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
            <div>
              <Eyebrow>La vidéo</Eyebrow>
              <h1 className="lp-display mt-4 text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-[color:var(--lp-title)] lg:text-[44px]">
                On remplit votre calendrier de rendez-vous.
              </h1>
              <p className="mt-4 text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
                Vous avez juste à bichonner les voitures de vos clients et à assurer vos
                prestations.
              </p>
            </div>

            {/*
              Lecteur vidéo. Tant que la vidéo de présentation n'est pas fournie, on
              montre l'emplacement et ce qu'il attend — pas une vidéo d'illustration
              prise ailleurs.
            */}
            <div
              className="mt-8 overflow-hidden rounded-[20px] border border-[#2c2440] lg:mt-0"
              style={{ background: "linear-gradient(160deg, #15121f, #0b0a10)" }}
            >
              <div className="relative grid aspect-video place-items-center">
                <button
                  type="button"
                  aria-label="Lire la vidéo de présentation"
                  disabled
                  className="lp-metal grid size-[72px] place-items-center rounded-full disabled:opacity-60"
                >
                  <IconPlay className="ml-0.5 size-7" />
                </button>
              </div>
              <p className="border-t border-[#1c1c25] px-4 py-3 text-center text-[12px] text-[color:var(--lp-note)]">
                [Vidéo de présentation à ajouter]
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Découvrir X Detailing ────────────────────────────────────── */}
      <Section id="decouvrir" className="border-t border-[color:var(--lp-rule)]">
        <Eyebrow>Découvrir X Detailing</Eyebrow>
        <h2 className="lp-display mt-4 max-w-2xl text-[26px] font-semibold leading-[1.2] text-[color:var(--lp-title)] lg:text-[34px]">
          Le lavage automobile mobile nouvelle génération.
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-[1.6] text-[color:var(--lp-body)]">
          Un concept pensé pour permettre à des indépendants de développer leur propre
          activité avec une identité de marque forte, des méthodes structurées et des
          outils digitaux.
        </p>
      </Section>

      {/* ── 3. Le point fort ────────────────────────────────────────────── */}
      <section id="calendrier" className="relative overflow-hidden border-t border-[#2a1f47]">
        <div aria-hidden className="lp-halo-top pointer-events-none absolute inset-x-0 top-0 h-[320px]" />
        <div className="relative mx-auto max-w-[480px] px-5 py-[52px] lg:max-w-[1100px] lg:py-20">
          <Eyebrow>Le point fort</Eyebrow>
          <h2 className="lp-display mt-4 max-w-2xl text-[30px] font-bold leading-[1.2] text-[color:var(--lp-title)] lg:text-[38px]">
            Vos rendez-vous arrivent directement dans votre calendrier.
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
            Vous n&apos;avez rien à chercher : nous remplissons votre agenda.
          </p>

          <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
            {/* Illustration d'agenda — décorative. */}
            <div
              aria-hidden
              className="rounded-[22px] border border-[#3a2c63] p-5"
              style={{ background: "#0d0c14", boxShadow: "0 0 44px -20px rgb(139 92 246 / 0.55)" }}
            >
              <div className="grid grid-cols-6 gap-1.5">
                {DAYS.map((day) => (
                  <p
                    key={day}
                    className="text-center text-[12px] font-bold text-[color:var(--lp-note)]"
                  >
                    {day}
                  </p>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-6 gap-1.5">
                {CALENDAR_PATTERN.flatMap((row, rowIndex) =>
                  row.map((cell, cellIndex) =>
                    cell ? (
                      <span
                        key={`${rowIndex}-${cellIndex}`}
                        className="lp-metal grid h-11 place-items-center rounded-[10px] text-[11px] font-extrabold"
                        style={{ border: "none", boxShadow: "none" }}
                      >
                        RDV
                      </span>
                    ) : (
                      <span
                        key={`${rowIndex}-${cellIndex}`}
                        className="h-11 rounded-[10px] border border-dashed border-[#2d2842] bg-[#0b0a10]"
                      />
                    ),
                  ),
                )}
              </div>
              <p className="mt-4 text-center text-[12px] text-[color:var(--lp-note)]">
                Illustration : votre calendrier alimenté par X Detailing.
              </p>
            </div>

            <div className="mt-4 space-y-3.5 lg:mt-0">
              <article className="lp-card-hi rounded-[22px] p-6">
                <span className="lp-metal mb-4 grid size-12 place-items-center rounded-[14px]">
                  <IconCalendar className="size-6" />
                </span>
                <Eyebrow>Nous</Eyebrow>
                <h3 className="lp-display mt-2 text-[19px] font-semibold text-[color:var(--lp-title)]">
                  On remplit votre calendrier
                </h3>
                <p className="mt-2 text-[16px] leading-[1.6] text-[color:var(--lp-body-hi)]">
                  Les rendez-vous arrivent directement dans votre agenda.
                </p>
              </article>

              <article className="lp-card rounded-[22px] p-6">
                <span className="mb-4 grid size-12 place-items-center rounded-[14px] border border-[#3a2c63] bg-[#1a1230] text-[color:var(--lp-accent)]">
                  <IconCar className="size-6" />
                </span>
                <Eyebrow>Vous</Eyebrow>
                <h3 className="lp-display mt-2 text-[19px] font-semibold text-[color:var(--lp-title)]">
                  Vous bichonnez
                </h3>
                <p className="mt-2 text-[16px] leading-[1.6] text-[color:var(--lp-body)]">
                  Vous vous occupez des voitures de vos clients et vous assurez vos
                  prestations.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Lancement clé en main ────────────────────────────────────── */}
      <Section id="lancement" className="border-t border-[color:var(--lp-rule)]">
        <Eyebrow>Clé en main</Eyebrow>
        <h2 className="lp-display mt-4 max-w-2xl text-[26px] font-semibold leading-[1.2] text-[color:var(--lp-title)] lg:text-[34px]">
          On fait tout pour vous lancer.
        </h2>
        <p className="mt-4 max-w-2xl text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
          Il faut seulement 3&nbsp;000&nbsp;€ d&apos;apport pour rejoindre le concept*. Si votre
          profil est sélectionné, nous nous occupons de tout.
        </p>

        <div
          className="mt-7 rounded-[22px] border border-[#4a3a7d] px-6 py-7 text-center"
          style={{
            background: "linear-gradient(160deg, #1a1236, #0f0c1c)",
            boxShadow: "0 0 44px -20px rgb(139 92 246 / 0.5)",
          }}
        >
          <p className="lp-display text-[40px] font-bold leading-none text-[color:var(--lp-title)]">
            3&nbsp;000&nbsp;€
          </p>
          <p className="mt-2 text-[16px] text-[color:var(--lp-body-hi)]">
            d&apos;apport seulement pour rejoindre le concept*
          </p>
        </div>

        <div className="mt-3.5 space-y-3.5 lg:grid lg:grid-cols-3 lg:gap-3.5 lg:space-y-0">
          {LAUNCH.map(({ Icon, title, body }) => (
            <article key={title} className="lp-card rounded-[22px] p-6">
              <span className="mb-4 grid size-12 place-items-center rounded-[14px] border border-[#3a2c63] bg-[#1a1230] text-[color:var(--lp-accent)]">
                <Icon className="size-6" />
              </span>
              <h3 className="lp-display text-[18px] font-semibold text-[color:var(--lp-title)]">
                {title}
              </h3>
              <p className="mt-2 text-[16px] leading-[1.6] text-[color:var(--lp-body)]">{body}</p>
            </article>
          ))}
        </div>

        <p className="mt-5 text-[12px] leading-[1.6] text-[color:var(--lp-note)]">
          * Sous réserve de la sélection de votre profil et de l&apos;acceptation de votre
          dossier de financement.
        </p>
      </Section>

      {/* ── 5. Chiffres clés ────────────────────────────────────────────── */}
      <Section id="chiffres" className="border-t border-[color:var(--lp-rule)]">
        <Eyebrow>Chiffres clés</Eyebrow>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <article className="lp-card-hi col-span-2 rounded-[22px] p-6 lg:col-span-4">
            <span className="lp-metal mb-4 grid size-12 place-items-center rounded-[14px]">
              <IconCalendar className="size-6" />
            </span>
            <p className="lp-display text-[20px] font-semibold leading-[1.3] text-[color:var(--lp-title)]">
              Votre calendrier se remplit : vous n&apos;avez qu&apos;à assurer vos
              prestations
            </p>
          </article>

          <article
            className="col-span-2 rounded-[22px] border border-[#4a3a7d] p-6 lg:col-span-4"
            style={{ background: "linear-gradient(160deg, #1a1236, #0f0c1c)" }}
          >
            <p className="lp-display text-[32px] font-bold leading-none text-[color:var(--lp-title)]">
              Jusqu&apos;à 7&nbsp;500&nbsp;€
            </p>
            <p className="mt-3 text-[16px] leading-[1.6] text-[color:var(--lp-body-hi)]">
              de chiffre d&apos;affaires par mois dans le lavage auto mobile*
            </p>
          </article>

          {[
            { value: "100\u00a0%", label: "Mobile" },
            { value: "1", label: "Concept" },
            { value: "1", label: "Secteur par opérateur" },
          ].map((item) => (
            <article key={item.label} className="lp-card min-h-[104px] rounded-[22px] p-5">
              <p className="lp-display text-[32px] font-bold leading-none text-[color:var(--lp-title)]">
                {item.value}
              </p>
              <p className="mt-2 text-[14px] text-[color:var(--lp-body)]">{item.label}</p>
            </article>
          ))}

          <article className="lp-card min-h-[104px] rounded-[22px] p-5">
            <span className="mb-3 grid size-10 place-items-center rounded-xl border border-[#3a2c63] bg-[#1a1230] text-[color:var(--lp-accent)]">
              <IconFlag className="size-5" />
            </span>
            <p className="text-[14px] leading-[1.5] text-[color:var(--lp-body)]">
              Un accompagnement de lancement
            </p>
          </article>

          <article className="lp-card col-span-2 rounded-[22px] p-5 lg:col-span-4">
            <span className="mb-3 grid size-10 place-items-center rounded-xl border border-[#3a2c63] bg-[#1a1230] text-[color:var(--lp-accent)]">
              <IconLayers className="size-5" />
            </span>
            <p className="text-[14px] leading-[1.5] text-[color:var(--lp-body)]">
              Un écosystème digital
            </p>
          </article>
        </div>

        <p className="mt-5 text-[12px] leading-[1.6] text-[color:var(--lp-note)]">
          * Ordre de grandeur observé dans le secteur, en chiffre d&apos;affaires mensuel.
          Les résultats varient selon l&apos;organisation, le secteur et le nombre de
          rendez-vous : ce n&apos;est pas une garantie de revenus.
        </p>
      </Section>

      {/* ── 6. Pourquoi X Detailing ? ───────────────────────────────────── */}
      <Section id="pourquoi" className="border-t border-[color:var(--lp-rule)]">
        <Eyebrow>Pourquoi X Detailing ?</Eyebrow>
        <h2 className="lp-display mt-4 max-w-2xl text-[26px] font-semibold leading-[1.2] text-[color:var(--lp-title)] lg:text-[34px]">
          Ce que vous gagnez à nous rejoindre.
        </h2>

        <div className="mt-7 space-y-3.5 lg:grid lg:grid-cols-2 lg:gap-3.5 lg:space-y-0">
          {REASONS.map((reason) => (
            <article key={reason.n} className="lp-card rounded-[22px] px-6 py-[26px]">
              <p className="lp-display text-[13px] font-semibold text-[color:var(--lp-accent)]">
                {reason.n}
              </p>
              <h3 className="lp-display mt-2 text-[20px] font-semibold leading-tight text-[color:var(--lp-title)]">
                {reason.title}
              </h3>
              <p className="mt-2 text-[16px] leading-[1.6] text-[color:var(--lp-body)]">
                {reason.body}
              </p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── 7. Témoignages ──────────────────────────────────────────────── */}
      {SHOW_TESTIMONIALS && (
        <Section id="temoignages" className="border-t border-[color:var(--lp-rule)]">
          <Eyebrow>Témoignages</Eyebrow>
          <h2 className="lp-display mt-4 max-w-2xl text-[26px] font-semibold leading-[1.2] text-[color:var(--lp-title)] lg:text-[34px]">
            Les retours de nos opérateurs.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.6] text-[color:var(--lp-body)]">
            Les vidéos et photos de nos premiers opérateurs apparaîtront ici.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-3 lg:max-w-[560px]">
            {[1, 2].map((index) => (
              <div
                key={index}
                className="grid aspect-[3/4] place-items-center rounded-[20px] border border-dashed border-[#3a3452] bg-[#0d0c13] px-4 text-center text-[12px] text-[color:var(--lp-note)]"
              >
                [Vidéo ou photo opérateur {index}/2]
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 8. Devenir opérateur ────────────────────────────────────────── */}
      <section id="devenir" className="relative overflow-hidden border-t border-[color:var(--lp-rule)]">
        <div aria-hidden className="lp-halo-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[340px]" />
        <div className="relative mx-auto max-w-[480px] px-5 py-[56px] lg:max-w-[1100px] lg:py-24">
          <Eyebrow>Devenir opérateur</Eyebrow>
          <h2 className="lp-display mt-4 max-w-2xl text-[26px] font-semibold leading-[1.2] text-[color:var(--lp-title)] lg:text-[34px]">
            Développez votre propre activité.
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-[1.6] text-[color:var(--lp-body)]">
            Déposez votre candidature : nous remplissons votre calendrier, vous assurez
            vos prestations.
          </p>

          <Link
            href="/candidature"
            className="lp-metal mt-8 flex h-[58px] max-w-[480px] items-center justify-center rounded-[16px] text-[15px] font-extrabold uppercase tracking-[0.1em]"
          >
            Devenir opérateur →
          </Link>
        </div>
      </section>

      {/* ── 9. Pied de page ─────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--lp-rule)]">
        {/* Marge basse généreuse : le bouton fixe ne doit jamais couvrir le contenu. */}
        <div className="mx-auto max-w-[480px] px-5 pb-[128px] pt-10 lg:max-w-[1100px]">
          <p className="text-[13px] text-[color:var(--lp-note)]">© X Detailing</p>
          <p className="mt-2 text-[13px] text-[color:var(--lp-note)]">
            Mentions légales [À RÉDIGER] · Politique de confidentialité [À RÉDIGER] ·
            Contact [À COMPLÉTER]
          </p>
        </div>
      </footer>

      <StickyApply />
    </>
  );
}
