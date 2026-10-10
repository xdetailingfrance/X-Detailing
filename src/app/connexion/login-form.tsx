"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const field =
  "mt-1 w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2.5 text-sm text-chrome-100 outline-none transition placeholder:text-chrome-500 focus:border-brand-500 focus:ring-4 focus:ring-brand-600/25";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(signIn, null);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-night-700 bg-night-850 p-6"
    >
      <label className="block">
        <span className="text-sm font-medium text-chrome-300">E-mail</span>
        <input id="email" name="email" type="email" autoComplete="username" required className={field} />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-chrome-300">Mot de passe</span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-xd-danger/40 bg-xd-danger/10 px-3 py-2 text-sm text-xd-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.22),0_8px_24px_-12px_rgb(12_12_17/0.18)] transition hover:bg-brand-500 disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
