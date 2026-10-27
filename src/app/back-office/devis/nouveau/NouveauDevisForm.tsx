"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Pack = {
  id: string;
  nom: string;
  tarifs: { categorie: string; prix: string }[];
};

type Option = {
  id: string;
  nom: string;
  prix: string;
};

const CATEGORIES = ["CITADINE", "BERLINE", "SUV", "MONOSPACE", "UTILITAIRE"];

export default function NouveauDevisForm({ packs, options }: { packs: Pack[]; options: Option[] }) {
  const router = useRouter();
  const [typeClient, setTypeClient] = useState<"PARTICULIER" | "PRO">("PARTICULIER");
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const [categorie, setCategorie] = useState("BERLINE");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const pack = useMemo(() => packs.find((p) => p.id === packId), [packs, packId]);
  const tarif = useMemo(() => pack?.tarifs.find((t) => t.categorie === categorie), [pack, categorie]);
  const prixOptions = options.filter((o) => optionIds.includes(o.id)).reduce((total, o) => total + Number(o.prix), 0);
  const prixTotal = tarif ? Number(tarif.prix) + prixOptions : null;
  const acompte = prixTotal != null ? Math.round(prixTotal * 0.1 * 100) / 100 : null;

   function basculerOption(id: string) {
     setOptionIds((liste) => (liste.includes(id) ? liste.filter((o) => o !== id) : [...liste, id]));
   }

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
     event.preventDefault();
     setErreur(null);
     setEnCours(true);

       const donnees = new FormData(event.currentTarget);
       const body = {
         typeClient,
         nomClient: donnees.get("nomClient"),
         telephoneClient: donnees.get("telephoneClient"),
         emailClient: donnees.get("emailClient") || undefined,
         raisonSociale: typeClient === "PRO" ? donnees.get("raisonSociale") || undefined : undefined,
         adresse: donnees.get("adresse"),
         ville: donnees.get("ville"),
         vehiculeDescription: donnees.get("vehiculeDescription") || undefined,
         categorieVehicule: categorie,
         packId,
         optionIds,
       };

       const res = await fetch("/api/devis", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
       });

       setEnCours(false);
       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         setErreur(data.error ?? "Erreur lors de la création du devis");
         return;
       }

       const devis = await res.json();
       router.push(`/back-office/devis/${devis.id}`);
   }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 max-w-2xl">
      <h2 className="font-medium">Prospect</h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTypeClient("PARTICULIER")}
          className={`rounded-md border px-3 py-1.5 text-sm ${typeClient === "PARTICULIER" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)]"}`}
        >
          Particulier
        </button>
        <button
          type="button"
          onClick={() => setTypeClient("PRO")}
          className={`rounded-md border px-3 py-1.5 text-sm ${typeClient === "PRO" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)]"}`}
        >
          Professionnel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Nom du client</span>
          <input name="nomClient" required className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Téléphone</span>
          <input name="telephoneClient" required className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
        </label>
      </div>

      {typeClient === "PRO" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Raison sociale</span>
          <input name="raisonSociale" className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
          </label>
        )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">E-mail (optionnel)</span>
        <input name="emailClient" type="email" className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Adresse</span>
          <input name="adresse" required className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Ville</span>
          <input name="ville" required className="rounded-md bg-[var(--surface-2)] border border-[var(--border)]px-3 py-2 text-sm" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Véhicule (marque, modèle)</span>
        <input name="vehiculeDescription" className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
      </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Catégorie</span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Pack</span>
            <select
              value={packId}
              onChange={(e) => setPackId(e.target.value)}
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        {options.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Options</span>
            {options.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={optionIds.includes(o.id)} onChange={() => basculerOption(o.id)} />
                {o.nom} (+{o.prix} €)
              </label>
            ))}
          </div>
        )}

      <div className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm flex flex-col gap-1">
        {tarif ? (
          <>
            <span>
              Prix total : <strong>{prixTotal} €</strong>
            </span>
            <span className="text-[var(--muted)]">Acompte (10 %) : {acompte} €</span>
            </>
          ) : (
            <span className="text-[var(--warning)]">Tarif non paramétré pour ce pack et cette catégorie.</span>
          )}
        </div>

        {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}

      <button
        type="submit"
        disabled={enCours || !tarif}
        className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
      >
        {enCours ? "Création…" : "Créer le devis"}
      </button>
    </form>
  );
}

