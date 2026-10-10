/**
 * Les engagements — une bande, pas quatre cartes.
 *
 * Chacun est tenu par le système, pas par un argumentaire : le déplacement est dans
 * le prix, le tarif est recalculé devant le client si la catégorie ne correspond pas
 * (§31), les seize photos conditionnent le démarrage et la clôture (§12), et
 * l'encaissement n'existe qu'après la prestation.
 *
 * Quatre cartes à ombre portée pour quatre phrases courtes, c'est trois fois la
 * hauteur nécessaire sur un écran de téléphone — et autant de défilement entre le
 * prix et le bouton.
 */

const ITEMS = [
  "Déplacement compris dans le prix",
  "Le prix affiché est le prix payé",
  "Seize photos avant et après",
  "Vous payez une fois que c'est fait",
];

export function Advantages() {
  return (
    <section className="border-y border-black/[0.08] bg-xd-abyss">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <ul className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-meta text-xd-text-2">
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-px size-4 shrink-0 text-xd-violet"
              >
                <path d="m4.5 10.5 3.5 3.5 7.5-8" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
