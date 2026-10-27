"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES_VEHICULE = [
  ["CITADINE", "Citadine"],
  ["BERLINE", "Berline"],
  ["SUV", "SUV"],
  ["MONOSPACE", "Monospace"],
  ["UTILITAIRE", "Utilitaire"],
] as const;

export default function NouveauClientForm() {
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
        adresse: {
          adresse: donnees.get("adresse"),
          ville: donnees.get("ville"),
          codePostal: donnees.get("codePostal") || undefined,
          latitude: donnees.get("latitude") ? Number(donnees.get("latitude")) : undefined,
          longitude: donnees.get("longitude") ? Number(donnees.get("longitude")) : undefined,
        },
        vehicule: {
          categorie: donnees.get("categorieVehicule"),
          marque: donnees.get("marque") || undefined,
          modele: donnees.get("modele") || undefined,
          immatriculation: donnees.get("immatriculation") || undefined,
        },
      };

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

       setEnCours(false);
       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         setErreur(data.error ?? "Erreur lors de la création du client");
         return;
       }

       event.currentTarget.reset();
       router.refresh();
   }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <h2 className="font-medium">Nouveau client</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Champ name="prenom" label="Prénom" required />
        <Champ name="nom" label="Nom" required />
        <Champ name="telephone" label="Téléphone" required />
        <Champ name="email" label="E-mail" type="email" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Champ name="adresse" label="Adresse" required className="col-span-2" />
        <Champ name="ville" label="Ville" required />
        <Champ name="codePostal" label="Code postal" />
        <Champ name="latitude" label="Latitude (géocodage manuel)" type="number" step="any" />
        <Champ name="longitude" label="Longitude (géocodage manuel)" type="number" step="any" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Catégorie véhicule</span>
          <select
            name="categorieVehicule"
            required
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            {CATEGORIES_VEHICULE.map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        </label>
        <Champ name="marque" label="Marque" />
        <Champ name="modele" label="Modèle" />
        <Champ name="immatriculation" label="Plaque (facultatif)" />
      </div>
      {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}
      <button
        type="submit"
        disabled={enCours}
        className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
      >
        {enCours ? "Création…" : "Créer le client"}
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

