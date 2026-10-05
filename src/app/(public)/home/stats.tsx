/**
 * Bandeau de chiffres (§8).
 *
 * Tout ce qui est affiché ici est compté dans la base au moment du rendu : le nombre
 * de prestations terminées, la note moyenne réellement laissée par les clients, le
 * nombre de communes couvertes. Aucun chiffre n'est écrit en dur.
 *
 * Une statistique sans substance ne s'affiche pas. Tant qu'il n'y a pas d'avis, la
 * tuile « note moyenne » disparaît au lieu d'annoncer un 5/5 que personne n'a donné —
 * c'est précisément le détail qu'un visiteur méfiant vérifie en premier.
 */

export type Stat = { value: string; label: string };

/** Les seize photos ne sont pas un argument commercial : le workflow les impose. */
export function buildStats(input: {
  completedCount: number;
  averageRating: number | null;
  reviewCount: number;
  sectorCount: number;
}): Stat[] {
  const stats: Stat[] = [];

  if (input.completedCount > 0) {
    stats.push({
      value: `${input.completedCount}`,
      label: input.completedCount > 1 ? "prestations réalisées" : "prestation réalisée",
    });
  }

  if (input.averageRating !== null && input.reviewCount > 0) {
    stats.push({
      value: input.averageRating.toFixed(1).replace(".", ","),
      label: `sur 5 · ${input.reviewCount} avis`,
    });
  }

  stats.push({ value: "16", label: "photos par prestation" });

  if (input.sectorCount > 0) {
    stats.push({
      value: `${input.sectorCount}`,
      label: input.sectorCount > 1 ? "secteurs couverts" : "secteur couvert",
    });
  }

  return stats;
}

export function Stats({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;

  return (
    <section className="border-y border-white/[0.06] bg-xd-abyss/60">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-5 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="px-2 py-8 text-center sm:py-10">
            <p className="tabular text-[2rem] font-semibold leading-none tracking-[-0.03em] text-xd-text sm:text-[2.4rem]">
              {stat.value}
            </p>
            <p className="mx-auto mt-2 max-w-[14ch] text-meta leading-snug text-xd-text-3">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
