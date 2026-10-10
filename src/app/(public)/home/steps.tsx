/**
 * Comment ça se passe — trois étapes, pas cinq.
 *
 * Ce bloc répond à la seule objection qui reste après le prix : « concrètement,
 * il se passe quoi ? ». Le détail du protocole vit sur les pages prestation ;
 * ici, trois lignes suffisent à lever le doute sans retarder le clic.
 */

const STEPS = [
  {
    n: "1",
    title: "Vous réservez",
    body: "Votre véhicule, la formule, l'adresse, le créneau. Trois départs par jour : 8 h 30, 11 h 30, 15 h.",
  },
  {
    n: "2",
    title: "On vient à vous",
    body: "L'opérateur arrive avec son eau et son matériel. Comptez deux heures sur place.",
  },
  {
    n: "3",
    title: "Vous recevez les photos",
    body: "Huit à l'arrivée, huit au départ, aux mêmes angles. Vous réglez une fois que c'est fait.",
  },
];

export function Steps() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <h2 className="text-center text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-xd-text sm:text-[2.2rem]">
        Comment ça se passe.
      </h2>

      <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step) => (
          <li key={step.n}>
            <span className="tabular inline-flex size-8 items-center justify-center rounded-full bg-xd-violet text-meta font-semibold text-white">
              {step.n}
            </span>
            <p className="mt-3.5 text-h3 font-semibold leading-tight text-xd-text">{step.title}</p>
            <p className="mt-2 text-meta leading-relaxed text-xd-text-3">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
