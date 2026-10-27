"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  adresses: { id: string; adresse: string; ville: string }[];
  vehicules: {
    id: string;
    categorie: string;
    marque: string | null;
    modele: string | null;
  }[];
};

type Pack = {
  id: string;
  nom: string;
  dureeMinMinutes: number;
  dureeMaxMinutes: number;
  tarifs: { categorie: string; prix: string }[];
};

type Option = {
  id: string;
  nom: string;
  prix: string;
};

export default function NouveauRdvForm({
  clients,
  packs,
  options,
}: {
  clients: Client[];
  packs: Pack[];
  options: Option[];
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [vehiculeId, setVehiculeId] = useState(clients[0]?.vehicules[0]?.id ?? "");
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

   const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
   const vehicule = useMemo(
     () => client?.vehicules.find((v) => v.id === vehiculeId),
     [client, vehiculeId]
   );
   const pack = useMemo(() => packs.find((p) => p.id === packId), [packs, packId]);
   const tarif = useMemo(
     () => pack?.tarifs.find((t) => t.categorie === vehicule?.categorie),
     [pack, vehicule]
   );

   const prixOptions = options
     .filter((o) => optionIds.includes(o.id))
     .reduce((total, o) => total + Number(o.prix), 0);
   const prixTotal = tarif ? Number(tarif.prix) + prixOptions : null;
   const acompte = prixTotal != null ? Math.round(prixTotal * 0.1 * 100) / 100 : null;

   function basculerOption(id: string) {
     setOptionIds((liste) =>
       liste.includes(id) ? liste.filter((o) => o !== id) : [...liste, id]
     );
   }

   async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
     event.preventDefault();
     setErreur(null);
     setEnCours(true);

       const donnees = new FormData(event.currentTarget);
       const date = donnees.get("date");
       const heure = donnees.get("heure");

       const body = {
         clientId: donnees.get("clientId"),
         adresseId: donnees.get("adresseId"),
         vehiculeId: donnees.get("vehiculeId"),
         packId: donnees.get("packId"),
         optionIds,
         dateHeure: `${date}T${heure}:00`,
         dureeMinutes: pack?.dureeMinMinutes,
         source: donnees.get("source"),
         notes: donnees.get("notes") || undefined,
       };

       const res = await fetch("/api/rendez-vous", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(body),
       });

       setEnCours(false);
       if (!res.ok) {
         const data = await res.json().catch(() => ({}));
         setErreur(data.error ?? "Erreur lors de la création du rendez-vous");
         return;
       }

       const rdv = await res.json();
       router.push(`/back-office/rendez-vous/${rdv.id}`);
   }

   if (clients.length === 0) {
     return (
       <p className="text-sm text-[var(--muted)]">
         Aucun client enregistré. Créez d&apos;abord un client depuis la page Clients.
       </p>
     );
   }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 max-w-2xl">
      <h2 className="font-medium">Nouveau rendez-vous</h2>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Client</span>
          <select
            name="clientId"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setVehiculeId(clients.find((c) => c.id === e.target.value)?.vehicules[0]?.id ?? "");
            }}
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom} — {c.telephone}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Adresse</span>
            <select
              name="adresseId"
              required
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              {client?.adresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.adresse}, {a.ville}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Véhicule</span>
            <select
              name="vehiculeId"
              required
              value={vehiculeId}
              onChange={(e) => setVehiculeId(e.target.value)}
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              {client?.vehicules.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.marque ?? v.categorie} {v.modele ?? ""} ({v.categorie})
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Pack</span>
          <select
            name="packId"
            required
            value={packId}
            onChange={(e) => setPackId(e.target.value)}
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          >
            {packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom} — {p.dureeMinMinutes}-{p.dureeMaxMinutes} min
              </option>
            ))}
          </select>
        </label>

        {options.length > 0 && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Options</span>
            <div className="flex flex-col gap-1">
              {options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={optionIds.includes(o.id)}
                    onChange={() => basculerOption(o.id)}
                  />
                  {o.nom} (+{o.prix} €)
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Date</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Heure</span>
            <input
              name="heure"
              type="time"
              required
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">Source</span>
            <select
              name="source"
              defaultValue="TELEPHONE"
              className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              <option value="TELEPHONE">Téléphone</option>
              <option value="LEAD_META">Lead Meta</option>
              <option value="SITE_CLIENT">Site client</option>
              <option value="LAVER_MAINTENANT">Laver maintenant</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Notes</span>
          <textarea
            name="notes"
            rows={2}
            className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>

      <div className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm flex flex-col gap-1">
        {tarif ? (
          <>
            <span>
              Prix total : <strong>{prixTotal} €</strong>
            </span>
            <span className="text-[var(--muted)]">
              Acompte (10 %) : {acompte} € · Solde à l&apos;intervention : {(prixTotal! - acompte!).toFixed(2)} €
            </span>
          </>
        ) : (
          <span className="text-[var(--warning)]">
              Tarif non paramétré pour ce pack et cette catégorie de véhicule ({vehicule?.categorie}).
              À renseigner dans Packs &amp; Options.
            </span>
          )}
        </div>

        {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}

      <button
        type="submit"
        disabled={enCours || !tarif}
        className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
      >
        {enCours ? "Création…" : "Créer le rendez-vous"}
      </button>
    </form>
  );
}

