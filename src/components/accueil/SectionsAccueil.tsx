import Link from "next/link";
import { ENTREPRISE } from "@/lib/entreprise";
import { TRANCHES_DEPLACEMENT, distanceMaxTarifee } from "@/lib/deplacement";
import { DELAI_ANNULATION_HEURES, TAUX_ACOMPTE } from "@/lib/rendezVous";
import type { PrestationPublique } from "@/lib/prestationsPubliques";

/**
 * Les sections de fond de la page d'accueil.
 *
 * Tout ce qui est affirmé ici est tiré du code : le barème kilométrique de
 * `deplacement.ts`, le taux d'acompte de `rendezVous.ts`, les durées et les
 * prix de la grille du back-office, les règles d'annulation des CGV. Rien
 * n'est rédigé « au feeling » : une promesse que le tunnel de réservation
 * contredirait coûte plus cher qu'une section vide.
 */

const KM_MAX = distanceMaxTarifee();

/**
 * Communes affichées ET déclarées en `areaServed`. Une seule liste : deux
 * listes finissent toujours par diverger, et un balisage qui annonce une
 * zone que la page ne montre pas est une incohérence que Google relève.
 */
export const COMMUNES = [
  "Bordeaux",
  "Mérignac",
  "Pessac",
  "Talence",
  "Bègles",
  "Bruges",
  "Le Bouscat",
  "Cenon",
  "Floirac",
  "Lormont",
  "Bassens",
  "Ambarès-et-Lagrave",
  "Villenave-d'Ornon",
  "Gradignan",
  "Artigues-près-Bordeaux",
  "Carignan-de-Bordeaux",
  "Tresses",
  "Latresne",
  "Créon",
  "Saint-Loubès",
  "Libourne",
];

function libelleTranche(index: number) {
  const bas = index === 0 ? 0 : TRANCHES_DEPLACEMENT[index - 1].jusquaKm;
  const haut = TRANCHES_DEPLACEMENT[index].jusquaKm;
  return bas === 0 ? `Jusqu'à ${haut} km` : `De ${bas} à ${haut} km`;
}

function Titre({ sur, children }: { sur: string; children: React.ReactNode }) {
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--violet-vif)]">{sur}</p>
      <h2 className="texte-chrome mt-3 text-2xl font-semibold uppercase tracking-[0.12em] sm:text-3xl">{children}</h2>
    </>
  );
}

export function Zone() {
  return (
    <section
      id="zone"
      className="scroll-mt-20 border-t border-[var(--encre)]/5 bg-white px-5 py-20 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <Titre sur="Zone d'intervention">Bordeaux et {KM_MAX} km autour</Titre>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--chrome)]/70 sm:text-base">
          Nous intervenons sur la métropole bordelaise et sa périphérie, jusqu&apos;à {KM_MAX} km. Les frais de
          déplacement ne sont pas estimés à la louche : à l&apos;étape adresse, la distance routière réelle est
          calculée et le forfait correspondant s&apos;affiche avant que vous ne validiez quoi que ce soit.
        </p>

        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          {TRANCHES_DEPLACEMENT.map((t, i) => (
            <div
              key={t.jusquaKm}
              className="rounded-2xl border border-[var(--encre)]/8 bg-[var(--encre)]/[0.015] px-5 py-6"
            >
              <dt className="text-sm font-medium text-[var(--encre)]">{libelleTranche(i)}</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums text-[var(--violet-vif)]">
                {t.prix === 0 ? "Offert" : `+ ${t.prix} €`}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-12 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--encre)]">
          Communes desservies
        </h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {COMMUNES.map((c) => (
            <li
              key={c}
              className="rounded-full border border-[var(--encre)]/10 px-3 py-1.5 text-xs text-[var(--chrome)]/75"
            >
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-[var(--chrome)]/55">
          Votre commune n&apos;est pas dans la liste ? Saisissez votre adresse dans la réservation : si elle est
          dans les {KM_MAX} km, le créneau et le forfait s&apos;affichent. Au-delà, écrivez-nous.
        </p>
      </div>
    </section>
  );
}

export function Materiel() {
  return (
    <section className="border-t border-[var(--encre)]/5 bg-[var(--encre)]/[0.02] px-5 py-20 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-[1fr_1.2fr] sm:gap-16">
        <div>
          <Titre sur="Sur place">L&apos;atelier vient à vous</Titre>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-[var(--chrome)]/70 sm:text-base">
          <p>
            L&apos;opérateur arrive avec son utilitaire équipé : eau, produits et aspirateurs sont à bord. Le
            lavage se fait à la main, devant chez vous, au bureau ou sur votre place de parking.
          </p>
          <p>
            Avant de commencer, l&apos;état du véhicule est photographié ; après la finition, il l&apos;est à
            nouveau. Ces photos restent attachées à votre dossier — elles tranchent une contestation sans
            discussion, dans un sens comme dans l&apos;autre.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Formules({ prestations }: { prestations: PrestationPublique[] }) {
  if (prestations.length === 0) return null;
  return (
    <section
      id="formules"
      className="scroll-mt-20 border-t border-[var(--encre)]/5 bg-white px-5 py-20 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <Titre sur="Les formules">Deux prestations, cinq gabarits</Titre>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[var(--chrome)]/70 sm:text-base">
          Le prix dépend de la taille du véhicule, pas d&apos;un devis à la tête du client. Citadine, berline,
          SUV, monospace, utilitaire : chaque gabarit a son tarif, affiché avant la réservation.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {prestations.map((p) => {
            const prix = p.tarifs.map((t) => t.prix).filter((n) => n > 0);
            return (
              <article
                key={p.packId}
                className="flex flex-col rounded-3xl border border-[var(--encre)]/8 px-6 py-7"
              >
                <h3 className="text-lg font-semibold text-[var(--encre)]">{p.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--chrome)]/70">{p.accroche}</p>
                {p.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--chrome)]/60">{p.description}</p>
                ) : null}
                <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--encre)]/8 pt-5 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-[var(--chrome)]/50">Durée</dt>
                    <dd className="mt-1 font-medium tabular-nums text-[var(--encre)]">{p.duree}</dd>
                  </div>
                  {prix.length > 0 ? (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.14em] text-[var(--chrome)]/50">Tarif</dt>
                      <dd className="mt-1 font-medium tabular-nums text-[var(--encre)]">
                        {Math.min(...prix)} à {Math.max(...prix)} €
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <a
                  href="#prestations"
                  className="mt-6 text-sm font-medium text-[var(--violet-vif)] hover:underline"
                >
                  Réserver cette formule →
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Chaque réponse se tient seule, sans le contexte de la page : c'est la
 * forme qu'un moteur ou un assistant peut citer. Les faits sont sourcés —
 * acompte de {TAUX_ACOMPTE}, barème de `deplacement.ts`, délai d'annulation
 * des CGV.
 */
export function questions(prestations: PrestationPublique[]) {
  // Les durées sont lues dans la grille, jamais écrites en dur : une FAQ qui
  // annonce 2h30 quand le back-office dit 3h est une promesse fausse.
  const parts = prestations.map((p) => `${p.duree} pour un ${p.titre.toLowerCase()}`);
  const durees =
    parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}` : parts[0];

  return [
    {
      q: "Jusqu'où vous déplacez-vous autour de Bordeaux ?",
      r: `X Detailing intervient sur la métropole bordelaise et jusqu'à ${KM_MAX} km autour. Le déplacement est offert dans les ${TRANCHES_DEPLACEMENT[0].jusquaKm} premiers kilomètres, puis facturé ${TRANCHES_DEPLACEMENT[1].prix} € jusqu'à ${TRANCHES_DEPLACEMENT[1].jusquaKm} km et ${TRANCHES_DEPLACEMENT[2].prix} € jusqu'à ${KM_MAX} km. La distance est calculée sur l'itinéraire routier réel au moment de la réservation, et le forfait s'affiche avant le paiement.`,
    },
    {
      q: "Combien de temps dure un lavage à domicile ?",
      r: `Comptez ${durees}, selon le gabarit du véhicule et son état. La durée de la formule choisie est indiquée au moment de la réservation, et le créneau est bloqué pour toute cette durée : aucun autre rendez-vous ne vient se superposer au vôtre.`,
    },
    {
      q: "Comment se passe le paiement ?",
      r: `Un acompte de ${Math.round(TAUX_ACOMPTE * 100)} % est réglé en ligne par carte à la réservation ; il confirme le créneau. Le solde se paie à la fin de l'intervention, par carte sur place ou en espèces. Une facture unique, reprenant l'acompte et le solde, vous est envoyée par e-mail en pièce jointe PDF dès le dossier clôturé.`,
    },
    {
      q: "Puis-je annuler ou décaler mon rendez-vous ?",
      // Formulation alignée sur l'article 7 des CGV : le report dans le délai
      // est un geste commercial, pas un droit. L'annoncer autrement créerait
      // un engagement que les conditions générales contredisent.
      r: `L'annulation est libre jusqu'à ${DELAI_ANNULATION_HEURES} heures avant le créneau : la prestation est alors reportée ou remboursée intégralement, acompte compris. Passé ce délai, l'acompte reste acquis, car le créneau a été immobilisé et ne peut plus être proposé. Nous pouvons proposer de déplacer le créneau selon les disponibilités, à titre de geste commercial.`,
    },
    {
      q: "Quels véhicules prenez-vous en charge ?",
      r: "Citadines, berlines, SUV, monospaces et utilitaires. Chaque gabarit a son propre tarif, affiché dans la grille avant la réservation : le prix ne change pas après l'intervention. Pour une flotte ou un véhicule hors gabarit, contactez-nous directement, nous établissons un devis.",
    },
    {
      q: "Faut-il un point d'eau ou une prise électrique ?",
      r: "Non. L'opérateur arrive avec son utilitaire équipé : eau, produits et aspirateurs sont à bord. Il suffit que le véhicule soit accessible et qu'il y ait de la place autour pour travailler — une place de parking, une allée ou une cour suffisent.",
    },
  ];
}

export type QuestionReponse = ReturnType<typeof questions>[number];

export function Questions({ prestations }: { prestations: PrestationPublique[] }) {
  const liste = questions(prestations);
  return (
    <section
      id="questions"
      className="scroll-mt-20 border-t border-[var(--encre)]/5 bg-[var(--encre)]/[0.02] px-5 py-20 sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <Titre sur="Questions fréquentes">Ce qu&apos;on nous demande</Titre>
        <div className="mt-10 divide-y divide-[var(--encre)]/8 border-y border-[var(--encre)]/8">
          {liste.map(({ q, r }) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-base font-medium text-[var(--encre)]">
                {q}
                <span
                  aria-hidden
                  className="mt-1 shrink-0 text-[var(--violet-vif)] transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--chrome)]/70">{r}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-[var(--chrome)]/60">
          Une autre question ?{" "}
          <a
            href={`https://wa.me/${ENTREPRISE.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--violet-vif)] hover:underline"
          >
            Écrivez-nous sur WhatsApp
          </a>
          {ENTREPRISE.email ? (
            <>
              {" "}ou à{" "}
              <a href={`mailto:${ENTREPRISE.email}`} className="font-medium text-[var(--violet-vif)] hover:underline">
                {ENTREPRISE.email}
              </a>
            </>
          ) : null}
          .
        </p>
      </div>
    </section>
  );
}

export function PiedDePage() {
  return (
    <footer className="border-t border-[var(--encre)]/5 bg-white px-5 py-12 text-sm sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
        <div>
          <p className="font-semibold uppercase tracking-[0.14em] text-[var(--encre)]">X Detailing</p>
          <p className="mt-3 leading-relaxed text-[var(--chrome)]/60">
            Lavage et detailing automobile à domicile, sur Bordeaux et {KM_MAX} km autour.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--chrome)]/50">Contact</p>
          <ul className="mt-3 space-y-2 text-[var(--chrome)]/70">
            <li>
              <a href={`tel:${ENTREPRISE.telephone}`} className="hover:text-[var(--encre)]">
                {ENTREPRISE.telephone}
              </a>
            </li>
            {ENTREPRISE.email ? (
              <li>
                <a href={`mailto:${ENTREPRISE.email}`} className="hover:text-[var(--encre)]">
                  {ENTREPRISE.email}
                </a>
              </li>
            ) : null}
            <li>
              <a
                href={ENTREPRISE.ficheGoogle}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--encre)]"
              >
                Fiche et avis Google
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--chrome)]/50">Informations</p>
          <ul className="mt-3 space-y-2 text-[var(--chrome)]/70">
            <li>
              <a href="#formules" className="hover:text-[var(--encre)]">Les formules</a>
            </li>
            <li>
              <a href="#zone" className="hover:text-[var(--encre)]">Zone d&apos;intervention</a>
            </li>
            <li>
              <a href="#questions" className="hover:text-[var(--encre)]">Questions fréquentes</a>
            </li>
            <li>
              <Link href="/conditions-generales" className="hover:text-[var(--encre)]">
                Conditions générales
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-5xl border-t border-[var(--encre)]/5 pt-6 text-xs text-[var(--chrome)]/45">
        © {new Date().getFullYear()} X Detailing — {ENTREPRISE.formeJuridique}
        {ENTREPRISE.capital ? ` au capital de ${ENTREPRISE.capital}` : ""} · SIREN {ENTREPRISE.siren}
      </p>
    </footer>
  );
}
