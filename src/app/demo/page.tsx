import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { DEMO_ENABLED, DEMO_PERSONAS } from "@/server/demo/mode";
import { enterAs } from "./actions";
import { ResetControl } from "./reset-control";

/**
 * Page d'entrée de la démonstration.
 *
 * C'est le lien que l'on partage. Elle doit répondre à trois questions en un écran :
 * qu'est-ce que je regarde, par où je commence, et qu'est-ce que je risque à cliquer.
 */

export const dynamic = "force-dynamic";
// La génération du jeu de données enchaîne des centaines d'écritures : depuis une
// fonction hébergée, chacune paie un aller-retour réseau vers la base. La minute par
// défaut serait trop juste.
export const maxDuration = 300;

export const metadata = {
  title: "X Detailing — démonstration",
  description: "Essayez le système complet : client, opérateur, standard, direction.",
  robots: { index: false, follow: false },
};

/** Le parcours d'une prestation, dans l'ordre où il se joue sur le terrain (§12). */
const JOURNEY = [
  { step: "Réservation", body: "Le client choisit sa prestation, son véhicule et un créneau réellement tenable. Il peut photographier sa voiture : l'analyse propose des options, sans jamais les ajouter d'elle-même." },
  { step: "Départ", body: "L'opérateur se met en route. Sa position n'est partagée qu'à partir de cet instant, et seulement avec ce client-là." },
  { step: "Photos avant", body: "Quatre angles obligatoires à l'arrivée. Sans eux, le lavage ne peut pas démarrer." },
  { step: "Lavage", body: "Si le véhicule n'est pas celui annoncé, l'opérateur le reclasse : le tarif change sous les yeux du client, qui doit l'accepter." },
  { step: "Photos après", body: "Les quatre mêmes angles au départ. Le client signe le bon d'intervention sur l'écran." },
  { step: "Paiement", body: "Carte ou espèces. Sans preuve complète, l'opérateur ne peut pas clôturer : le rendez-vous part en impayé documenté." },
];

export default async function DemoPage() {
  // Hors démonstration, cette page n'existe pas : elle ouvre des sessions sans mot de passe.
  if (!DEMO_ENABLED) notFound();

  // Sur un déploiement neuf, les tables existent mais sont vides. Plutôt que de proposer
  // des identités qui n'existent pas encore, on propose de peupler la base.
  const seeded = (await prisma.user.count()) > 0;

  return (
    <div className="min-h-dvh bg-night-950 text-chrome-100 [color-scheme:dark]">
      {/* Lumière de studio dirigée, pas une nappe violette centrée (§54). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(70%_60%_at_18%_0%,rgb(123_60_255/0.16),transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-5 py-12 sm:py-16">
        <header className="flex items-center gap-3">
          <Image src="/marque/x-mark.png" alt="" width={512} height={364} priority className="h-8 w-auto" />
          <span className="font-display text-[13px] font-bold uppercase tracking-[0.28em] text-chrome-200">
            Detailing
          </span>
          <span className="ml-auto rounded-full px-3 py-1 text-xs font-medium tracking-wide text-brand-300 m-purple">
            Démonstration
          </span>
        </header>

        <div className="mt-10 max-w-2xl">
          <h1 className="font-display text-[2.4rem] leading-[1.05] font-extrabold tracking-tight text-xd-text sm:text-[3.1rem]">
            Le système entier, ouvert.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-chrome-300">
            Un réseau lyonnais fictif — quatre opérateurs, huit clients, une quinzaine de
            rendez-vous — avec une journée en cours quelle que soit l&apos;heure à laquelle
            vous arrivez. Choisissez un point de vue et manipulez&nbsp;: réservez, prenez de
            vraies photos, encaissez, clôturez.
          </p>
          <p className="mt-3 text-sm text-chrome-500">
            Rien n&apos;est réel : aucun paiement n&apos;est débité, aucun message n&apos;est
            envoyé. Tout se remet à zéro en bas de page.
          </p>
        </div>

        {/* ── Points de vue ────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-chrome-500">
            {seeded ? "Par où entrer" : "Première ouverture"}
          </h2>
          {!seeded ? (
            <div className="mt-4 rounded-[22px] p-6 m-smoked hairline">
              <p className="font-display text-lg font-bold text-xd-text">
                La base est encore vide.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-chrome-400">
                Générez le réseau fictif — quatre opérateurs, huit clients, une quinzaine de
                rendez-vous, la grille tarifaire complète. Quelques secondes.
              </p>
              <div className="mt-5">
                <ResetControl
                  label="Générer le jeu de démonstration"
                  confirmLabel="Générer maintenant"
                  doneLabel="Réseau fictif en place."
                />
              </div>
            </div>
          ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {DEMO_PERSONAS.map((persona) => (
              <form
                key={persona.key}
                action={enterAs}
                className="group flex flex-col rounded-[22px] p-6 m-smoked hairline transition duration-150 hover:-translate-y-px hover:shadow-[0_18px_40px_-24px_rgb(12_12_17/0.24)]"
              >
                <input type="hidden" name="persona" value={persona.key} />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-xl font-bold text-xd-text">{persona.label}</span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-chrome-500">
                    {persona.role}
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-chrome-400">{persona.errand}</p>
                <button
                  type="submit"
                  className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition duration-150 hover:bg-brand-500"
                >
                  Entrer comme {persona.label.toLowerCase()}
                </button>
              </form>
            ))}
          </div>
          )}
        </section>

        {/* ── Le parcours ──────────────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-chrome-500">
            Le parcours complet d&apos;une prestation
          </h2>
          <ol className="mt-4 overflow-hidden rounded-[22px] m-graphite hairline">
            {JOURNEY.map((item, index) => (
              <li
                key={item.step}
                className={`flex gap-5 px-6 py-5 ${index > 0 ? "hairline-t" : ""}`}
              >
                <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-brand-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-display text-base font-bold text-xd-text">{item.step}</p>
                  <p className="mt-1 text-sm leading-relaxed text-chrome-400">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-chrome-500">
            Les étapes 3 à 6 se jouent depuis le point de vue opérateur, sur téléphone de
            préférence : c&apos;est là que se prennent les photos.
          </p>
        </section>

        {/* ── Liens directs ────────────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-chrome-500">
            Un lien par parcours
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-chrome-400">
            À envoyer séparément : chacun ouvre directement l&apos;espace concerné, sans
            passer par cette page ni choisir dans une liste.
          </p>
          <ul className="mt-4 overflow-hidden rounded-[22px] m-graphite hairline">
            {DEMO_PERSONAS.map((persona, index) => (
              <li
                key={persona.key}
                className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-4 ${
                  index > 0 ? "hairline-t" : ""
                }`}
              >
                <span className="font-display text-base font-bold text-xd-text">
                  {persona.label}
                </span>
                <code className="font-mono text-sm text-brand-300">/demo/{persona.key}</code>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Remise à zéro ────────────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-chrome-500">
            Repartir de zéro
          </h2>
          <div className="mt-4 rounded-[22px] p-6 m-smoked hairline">
            <p className="text-sm leading-relaxed text-chrome-400">
              Efface tout ce qui a été produit pendant l&apos;essai — rendez-vous créés,
              photos prises, paiements, signatures — et régénère le réseau fictif tel qu&apos;il
              est à l&apos;ouverture. Les comptes reprennent leurs identifiants d&apos;origine.
            </p>
            <div className="mt-5">
              <ResetControl />
            </div>
          </div>
        </section>

        <footer className="mt-12 text-sm text-chrome-500">
          <p>
            Pour se connecter à la main : tous les comptes utilisent le mot de passe{" "}
            <code className="rounded bg-night-800 px-1.5 py-0.5 font-mono text-chrome-300">xdetailing</code>{" "}
            — direction <code className="font-mono text-chrome-300">patron@xdetailing.fr</code>,
            standard <code className="font-mono text-chrome-300">conseiller@xdetailing.fr</code>,
            opérateurs <code className="font-mono text-chrome-300">mehdi</code>,{" "}
            <code className="font-mono text-chrome-300">julien</code>,{" "}
            <code className="font-mono text-chrome-300">sofiane</code>,{" "}
            <code className="font-mono text-chrome-300">thomas</code>
            <code className="font-mono text-chrome-300">@xdetailing.fr</code>.
          </p>
        </footer>
      </div>
    </div>
  );
}
