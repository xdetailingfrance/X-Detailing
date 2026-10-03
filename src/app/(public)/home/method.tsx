import { formatDuration } from "@/server/time";

/**
 * La méthode (§8, expérience 06).
 *
 * Ce n'est pas une section « notre savoir-faire » : ce sont les étapes que le système
 * impose réellement à l'opérateur, et qu'il ne peut pas sauter. Le workflow refuse de
 * démarrer sans les photos d'arrivée et refuse d'encaisser sans celles du départ.
 *
 * C'est le meilleur argument du site parce qu'il est vérifiable — le client reçoit les
 * photos. Aucun lavage automatique ne peut en dire autant.
 */

const STEPS = [
  {
    step: "01",
    title: "Contrôle à l'arrivée",
    body: "L'opérateur relève le véhicule et sa catégorie. Si elle ne correspond pas à la réservation, le tarif est recalculé devant vous — et il attend votre accord pour continuer.",
  },
  {
    step: "02",
    title: "Huit photos avant",
    body: "Les quatre faces, les deux flancs, l'habitacle et le coffre. Horodatées, rattachées au véhicule. La prestation ne peut pas démarrer tant qu'elles manquent.",
  },
  {
    step: "03",
    title: "La prestation",
    body: null, // rempli avec la durée réelle
  },
  {
    step: "04",
    title: "Huit photos après",
    body: "Les mêmes angles, au même endroit. C'est la comparaison qui prouve le travail, pas une photo isolée prise sous le bon éclairage.",
  },
  {
    step: "05",
    title: "Bon signé, puis paiement",
    body: "Vous signez la prise en charge sur l'écran, vous réglez le solde. Sans preuve complète, l'opérateur ne peut pas clôturer.",
  },
];

export function Method({ shortestMin, longestMin }: { shortestMin: number; longestMin: number }) {
  const durationLine =
    shortestMin === longestMin
      ? `Comptez ${formatDuration(shortestMin)} sur place.`
      : `Comptez ${formatDuration(shortestMin)} à ${formatDuration(longestMin)} selon la formule et la taille du véhicule.`;

  return (
    <section id="methode" className="scroll-mt-24 border-y border-white/[0.06] bg-xd-abyss/60">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
          On ne vous demande pas de nous croire.
        </h2>
        <p className="mt-4 max-w-xl text-body text-xd-text-3">
          Seize photos par prestation, huit à l&apos;arrivée et huit au départ. Vous les
          recevez. L&apos;opérateur ne peut ni démarrer ni encaisser sans elles.
        </p>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-[--radius-xd-xl] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((item) => (
            <li key={item.step} className="bg-xd-carbon px-6 py-7">
              <p className="tabular text-meta font-semibold text-xd-violet-highlight">
                {item.step}
              </p>
              <p className="mt-3 text-h3 font-semibold leading-tight text-xd-text">
                {item.title}
              </p>
              <p className="mt-2.5 text-meta leading-relaxed text-xd-text-3">
                {item.body ?? durationLine}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
