"use client";

import { useActionState } from "react";
import { seConnecter, type ConnexionState } from "./actions";

export function Connexion() {
  const [state, action, pending] = useActionState<ConnexionState, FormData>(seConnecter, {});

  return (
    <form action={action} className="card rounded-xd-xl p-6 sm:p-8">
      <label className="block">
        <span className="text-sm font-medium text-xd-text-2">Mot de passe</span>
        <input
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={Boolean(state.erreur)}
          aria-describedby={state.erreur ? "err-mdp" : undefined}
          className="field mt-1.5"
        />
      </label>
      {state.erreur && (
        <p id="err-mdp" role="alert" className="mt-2 text-sm text-xd-danger">
          {state.erreur}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary mt-5 w-full">
        {pending ? "Vérification…" : "Entrer"}
      </button>
    </form>
  );
}
