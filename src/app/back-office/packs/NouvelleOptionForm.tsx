"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NouvelleOptionForm() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setErreur(null);
      setEnCours(true);

      const donnees = new FormData(event.currentTarget);
      const res = await fetch("/api/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: donnees.get("nom"),
          prix: Number(donnees.get("prix")),
        }),
      });

      setEnCours(false);
       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         setErreur(data.error ?? "Erreur lors de la création de l'option");
         return;
       }

       event.currentTarget.reset();
       router.refresh();
   }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Nom de l&apos;option</span>
        <input
          name="nom"
          required
          className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Prix (€)</span>
        <input
          name="prix"
          type="number"
          step="0.01"
          required
          className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm w-32"
        />
      </label>
      <button
        type="submit"
        disabled={enCours}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
      >
        {enCours ? "Ajout…" : "Ajouter"}
      </button>
      {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}
    </form>
  );
}

