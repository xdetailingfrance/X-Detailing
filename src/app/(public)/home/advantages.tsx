/**
 * « On fait les choses bien » (§8).
 *
 * Quatre promesses, et chacune est tenue par le système, pas par un argumentaire :
 * le déplacement est dans le prix, le tarif est recalculé devant le client si la
 * catégorie ne correspond pas (§31), les seize photos conditionnent le démarrage et la
 * clôture (§12), et l'encaissement n'existe qu'après la prestation.
 *
 * C'est la différence entre une liste d'avantages et une liste de contraintes qu'on
 * s'impose. Seule la seconde est vérifiable par le visiteur.
 */

const ITEMS = [
  {
    title: "Chez vous, ou au bureau",
    body: "L'opérateur arrive avec son eau et son matériel. Vous n'avez rien à prévoir, rien à déplacer.",
    icon: (
      <>
        <path d="M3 10.5 12 4l9 6.5" />
        <path d="M5 9.8V20h14V9.8" />
        <path d="M10 20v-5h4v5" />
      </>
    ),
  },
  {
    title: "Le prix affiché est le prix payé",
    body: "Pas de supplément découvert à la fin. Si la catégorie du véhicule ne correspond pas, le tarif est recalculé devant vous et attend votre accord.",
    icon: (
      <>
        <path d="M17.5 7.3a5.8 5.8 0 1 0 0 9.4" />
        <path d="M4.8 11h7.4" />
        <path d="M4.8 14h7.4" />
      </>
    ),
  },
  {
    title: "Seize photos, et vous les recevez",
    body: "Huit à l'arrivée, huit au départ, aux mêmes angles. L'opérateur ne peut ni démarrer ni clôturer sans elles.",
    icon: (
      <>
        <path d="M3 8.5h3.2L8 6h8l1.8 2.5H21V19H3z" />
        <circle cx="12" cy="13.2" r="3.4" />
      </>
    ),
  },
  {
    title: "Vous payez une fois que c'est fait",
    body: "Rien n'est prélevé à la réservation. Vous signez la prise en charge, puis vous réglez, sur place.",
    icon: (
      <>
        <path d="M3 7.5h18V19H3z" />
        <path d="M3 11h18" />
        <path d="M6.5 15.5h3.5" />
      </>
    ),
  },
];

export function Advantages() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
      <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
        On fait les choses bien.
      </h2>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <li
            key={item.title}
            className="glass glass-interactive flex flex-col rounded-[--radius-xd-xl] p-6"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-7 text-xd-violet-highlight"
            >
              {item.icon}
            </svg>
            <p className="mt-4 text-h3 font-semibold leading-tight text-xd-text">{item.title}</p>
            <p className="mt-2.5 text-meta leading-relaxed text-xd-text-3">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
