"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { plageDureeLisible } from "@/lib/heure";

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
  // Prendre un rendez-vous pour quelqu'un qui appelle pour la première fois
  // ne doit pas obliger à ouvrir la page Clients, créer la fiche, puis
  // revenir : les deux se font ici.
  const [nouveau, setNouveau] = useState(clients.length === 0);
  const [recherche, setRecherche] = useState("");
  const [fiche, setFiche] = useState({
    prenom: "",
    nom: "",
    telephone: "",
    email: "",
    adresse: "",
    codePostal: "",
    ville: "",
    categorie: "BERLINE",
    marque: "",
    modele: "",
  });
  const champFiche = (nom: keyof typeof fiche) => ({
    value: fiche[nom],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFiche({ ...fiche, [nom]: e.target.value }),
  });

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return clients;
    const chiffres = q.replace(/\D/g, "");
    return clients.filter(
      (c) =>
        `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
        (chiffres.length >= 2 && c.telephone.replace(/\D/g, "").includes(chiffres))
    );
  }, [clients, recherche]);

   const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
   const vehicule = useMemo(
     () => client?.vehicules.find((v) => v.id === vehiculeId),
     [client, vehiculeId]
   );
   const pack = useMemo(() => packs.find((p) => p.id === packId), [packs, packId]);
   // En création de fiche, la catégorie vient du formulaire : lire celle du
   // client sélectionné afficherait un prix que le rendez-vous ne portera pas.
   const categorie = nouveau ? fiche.categorie : vehicule?.categorie;
   const tarif = useMemo(
     () => pack?.tarifs.find((t) => t.categorie === categorie),
     [pack, categorie]
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

       // Nouveau client : la fiche est créée d'abord, puis le rendez-vous s'y
       // rattache. L'adresse est géocodée au passage, ce qui conditionne
       // l'attribution automatique à un opérateur.
       let ids = {
         clientId: donnees.get("clientId") as string | null,
         adresseId: donnees.get("adresseId") as string | null,
         vehiculeId: donnees.get("vehiculeId") as string | null,
       };
       if (nouveau) {
         const res = await fetch("/api/clients", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             prenom: fiche.prenom,
             nom: fiche.nom,
             telephone: fiche.telephone,
             email: fiche.email || null,
             adresse: { adresse: fiche.adresse, ville: fiche.ville, codePostal: fiche.codePostal || null },
             vehicule: { categorie: fiche.categorie, marque: fiche.marque || null, modele: fiche.modele || null },
           }),
         });
         if (!res.ok) {
           const data = await res.json().catch(() => ({}));
           setEnCours(false);
           setErreur(data.error ?? "Création du client impossible.");
           return;
         }
         const cree = await res.json();
         ids = { clientId: cree.id, adresseId: cree.adresses[0]?.id ?? null, vehiculeId: cree.vehicules[0]?.id ?? null };
       }

       const body = {
         clientId: ids.clientId,
         adresseId: ids.adresseId,
         vehiculeId: ids.vehiculeId,
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

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 max-w-2xl">
      <h2 className="font-medium">Nouveau rendez-vous</h2>

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => setNouveau(false)}
            disabled={clients.length === 0}
            className={`rounded-md border px-3 py-1.5 transition disabled:opacity-40 ${
              nouveau ? "border-[var(--border)] hover:bg-[var(--surface-2)]" : "border-[var(--accent)] bg-[var(--accent)]/10"
            }`}
          >
            Client existant
          </button>
          <button
            type="button"
            onClick={() => setNouveau(true)}
            className={`rounded-md border px-3 py-1.5 transition ${
              nouveau ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] hover:bg-[var(--surface-2)]"
            }`}
          >
            Nouveau client
          </button>
        </div>

        {nouveau ? (
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border border-[var(--border)] p-3">
            <legend className="px-1 text-xs uppercase tracking-wide text-[var(--muted)]">Fiche client</legend>
            <Champ libelle="Prénom" requis {...champFiche("prenom")} />
            <Champ libelle="Nom" requis {...champFiche("nom")} />
            <Champ libelle="Téléphone" requis type="tel" {...champFiche("telephone")} />
            <Champ libelle="E-mail (facultatif)" type="email" {...champFiche("email")} />
            <Champ libelle="Adresse d'intervention" requis large {...champFiche("adresse")} />
            <Champ libelle="Code postal" {...champFiche("codePostal")} />
            <Champ libelle="Ville" requis {...champFiche("ville")} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Catégorie du véhicule</span>
              <select
                {...champFiche("categorie")}
                className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
              >
                {["CITADINE", "BERLINE", "SUV", "MONOSPACE", "UTILITAIRE"].map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <Champ libelle="Marque (facultatif)" {...champFiche("marque")} />
            <Champ libelle="Modèle (facultatif)" {...champFiche("modele")} />
            <p className="sm:col-span-2 text-xs text-[var(--muted)]">
              Le code postal lève les homonymies entre communes : sans lui, l&apos;adresse peut être située ailleurs
              en France, et le rendez-vous reste inattribuable.
            </p>
          </fieldset>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Rechercher</span>
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom ou téléphone"
                className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">Client</span>
              <select
                name="clientId"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setVehiculeId(clients.find((c) => c.id === e.target.value)?.vehicules[0]?.id ?? "");
                }}
                size={Math.min(8, Math.max(2, filtres.length))}
                className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
              >
                {filtres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom} — {c.telephone}
                  </option>
                ))}
              </select>
            </label>
            {filtres.length === 0 && (
              <p className="text-xs text-[var(--muted)]">
                Aucun client ne correspond.{" "}
                <button type="button" onClick={() => setNouveau(true)} className="underline">
                  Créer une fiche
                </button>
              </p>
            )}
          </div>
        )}

        {!nouveau && (
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
        )}

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
                {p.nom} — {plageDureeLisible(p.dureeMinMinutes, p.dureeMaxMinutes)}
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

function Champ({
  libelle,
  requis,
  type = "text",
  large,
  value,
  onChange,
}: {
  libelle: string;
  requis?: boolean;
  type?: string;
  large?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${large ? "sm:col-span-2" : ""}`}>
      <span className="text-[var(--muted)]">{libelle}</span>
      <input
        type={type}
        required={requis}
        value={value}
        onChange={onChange}
        className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
      />
    </label>
  );
}
