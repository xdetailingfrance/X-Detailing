import { TRAVEL_BANDS } from "@/server/tarifs";

/**
 * Les engagements.
 *
 * Chacun est tenu par le système, pas par un argumentaire : le déplacement est
 * calculé depuis le point de départ et annoncé avant validation, le tarif est
 * recalculé devant le client si la catégorie ne correspond pas (§31), les seize
 * photos conditionnent le démarrage et la clôture (§12), et l'encaissement n'existe
 * qu'après la prestation.
 *
 * La première borne de la grille est lue dans `TRAVEL_BANDS`, jamais recopiée : le
 * jour où elle bouge, la promesse affichée bouge avec la facturation. Une page qui
 * annonce quinze kilomètres offerts pendant que le panier en facture dix est pire
 * qu'une page qui n'annonce rien.
 */

const FREE_KM = TRAVEL_BANDS[0].upToKm;

const ITEMS = [
  {
    title: `Déplacement offert jusqu'à ${FREE_KM} km`,
    body: "Au-delà, le supplément s'affiche avant que vous validiez. Jamais découvert après.",
    icon: (
      <>
        <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.6" />
      </>
    ),
  },
  {
    title: "Le prix affiché est le prix payé",
    body: "Si la catégorie du véhicule ne correspond pas, le tarif est recalculé devant vous et attend votre accord.",
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
    <section className="border-y border-black/[0.07] bg-xd-abyss">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
        <ul className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <li key={item.title}>
              {/*
                L'icône est posée sur un carré violet très pâle plutôt que sur rien :
                sans fond, quatre traits violets flottant sur du gris se lisent comme
                des pictogrammes décoratifs, pas comme le début d'un bloc.
              */}
              <span className="inline-flex size-10 items-center justify-center rounded-[--radius-xd-sm] bg-xd-violet-dark">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-5 text-xd-violet-highlight"
                >
                  {item.icon}
                </svg>
              </span>

              <p className="mt-3.5 text-body font-semibold leading-snug tracking-[-0.01em] text-xd-text">
                {item.title}
              </p>
              <p className="mt-1.5 text-meta leading-relaxed text-xd-text-3">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
