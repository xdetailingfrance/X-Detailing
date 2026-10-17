"use client";

import { useState, useTransition } from "react";
import { libererCreneau, seDeconnecter } from "./actions";

/**
 * Libérer un créneau : deux clics, pas un.
 *
 * Le premier bascule le bouton en demande de confirmation ; le second libère. Pas
 * de fenêtre native : elle est laide, et un `confirm()` se ferme d'un pouce
 * distrait sur un téléphone.
 */
export function BoutonLiberer({ id, libelle }: { id: string; libelle: string }) {
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirmation) {
    return (
      <button
        type="button"
        onClick={() => setConfirmation(true)}
        className="btn btn-secondary btn-sm"
      >
        Libérer le créneau
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const resultat = await libererCreneau(id);
            if (!resultat.ok) setErreur(resultat.erreur);
          })
        }
        className="btn btn-sm bg-xd-danger text-white hover:bg-[#a52a2f]"
      >
        {pending ? "Libération…" : `Oui, libérer ${libelle}`}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirmation(false)}
        className="btn btn-secondary btn-sm"
      >
        Annuler
      </button>
      {erreur && (
        <p role="alert" className="w-full text-sm text-xd-danger">
          {erreur}
        </p>
      )}
    </div>
  );
}

export function BoutonDeconnexion() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => seDeconnecter())}
      className="text-sm text-xd-text-3 transition-colors hover:text-xd-text"
    >
      Se déconnecter
    </button>
  );
}
