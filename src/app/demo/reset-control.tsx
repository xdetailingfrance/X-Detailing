"use client";

import { useState, useTransition } from "react";
import { resetDemoData } from "./actions";

/**
 * Remise à zéro en deux temps.
 *
 * L'action est destructrice et sans retour : un seul clic serait un piège pour quelqu'un
 * qui explore. On demande donc une confirmation explicite, à côté du bouton plutôt que
 * dans une boîte de dialogue — la phrase reste lisible pendant qu'on décide.
 */
export function ResetControl({
  label = "Remettre la démonstration à zéro",
  confirmLabel = "Oui, tout effacer",
  doneLabel = "Jeu de données régénéré.",
}: {
  label?: string;
  confirmLabel?: string;
  doneLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return (
      <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => {
          setDone(false);
          setArmed(true);
        }}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-chrome-200 m-polished hairline transition duration-150 hover:text-xd-text"
      >
        {label}
      </button>
      {done ? (
        <p className="text-sm text-xd-ok">{doneLabel}</p>
      ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await resetDemoData();
              setDone(true);
              setArmed(false);
            } catch {
              setError("La remise à zéro n'a pas abouti. Réessayez dans un instant.");
            }
          })
        }
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition duration-150 hover:bg-brand-500 disabled:opacity-60"
      >
        {pending ? "Génération en cours…" : confirmLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setArmed(false)}
        className="text-sm font-medium text-chrome-400 transition hover:text-chrome-200"
      >
        Annuler
      </button>
      {error ? <p className="text-sm text-xd-danger">{error}</p> : null}
    </div>
  );
}
