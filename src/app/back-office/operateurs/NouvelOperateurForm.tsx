"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Secteur = { id: string; nom: string };

export default function NouvelOperateurForm({ secteurs }: { secteurs: Secteur[] }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
     event.preventDefault();
     setErreur(null);
     setEnCours(true);

      const donnees = new FormData(event.currentTarget);
      const body = {
        prenom: donnees.get("prenom"),
        nom: donnees.get("nom"),
        telephone: donnees.get("telephone"),
        email: donnees.get("email") || undefined,
        secteurId: donnees.get("secteurId") || undefined,
        adresseDomicile: donnees.get("adresseDomicile") || undefined,
        latitudeDomicile: donnees.get("latitude") ? Number(donnees.get("latitude")) : undefined,
        longitudeDomicile: donnees.get("longitude") ? Number(donnees.get("longitude")) : undefined,
        heureDebut: donnees.get("heureDebut") || undefined,
        heureFin: donnees.get("heureFin") || undefined,
        kangooImmatriculation: donnees.get("kangoo") || undefined,
      };

      const res = await fetch("/api/operateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setEnCours(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErreur(data.error ?? "Erreur lors de la création de l'opérateur");
        return;
      }

       event.currentTarget.reset();
       router.refresh();
   }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <h2 className="font-medium">Nouvel opérateur</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Champ name="prenom" label="Prénom" required />
        <Champ name="nom" label="Nom" required />
        <Champ name="telephone" label="Téléphone" required />
        <Champ name="email" label="E-mail" type="email" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Secteur</span>
          <select
            name="secteurId"
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            <option value="">— aucun —</option>
            {secteurs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </label>
        <Champ name="kangoo" label="Immatriculation Kangoo" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Champ name="adresseDomicile" label="Adresse domicile" className="col-span-2" />
        <Champ name="latitude" label="Latitude (géocodage manuel)" type="number" step="any" required />
        <Champ name="longitude" label="Longitude (géocodage manuel)" type="number" step="any" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Champ name="heureDebut" label="Début de journée" type="time" />
        <Champ name="heureFin" label="Fin de journée" type="time" />
      </div>
      {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}
      <button
        type="submit"
        disabled={enCours}
        className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
      >
        {enCours ? "Création…" : "Créer l'opérateur"}
      </button>
    </form>
  );
}

function Champ({
  name,
  label,
  type = "text",
  required,
  step,
  className,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className ?? ""}`}>
      <span className="text-[var(--muted)]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        step={step}
        className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
      />
    </label>
    );
}

