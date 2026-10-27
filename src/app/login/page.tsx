"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LogoMarque from "@/components/accueil/LogoMarque";

export default function LoginPage() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setErreur(null);
      setEnCours(true);

      const donnees = new FormData(event.currentTarget);
      const res = await fetch("/api/auth/login", {
        method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           email: donnees.get("email"),
           motDePasse: donnees.get("motDePasse"),
         }),
       });

       if (!res.ok) {
         setEnCours(false);
         const data = await res.json().catch(() => ({}));
         setErreur(data.error ?? "Connexion impossible");
         return;
       }

       const { role } = await res.json();
       router.push(role === "OPERATEUR" ? "/operateur" : "/back-office");
       router.refresh();
   }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 flex flex-colgap-4"
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <LogoMarque className="h-20 w-20" />
          <h1 className="font-semibold">X Detailing OS</h1>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">E-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Mot de passe</span>
          <input
            name="motDePasse"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}
        <button
          type="submit"
          disabled={enCours}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
        >
          {enCours ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

