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
  const [echecEnvoi, setEchecEnvoi] = useState<{ id: string; erreur: string } | null>(null);
  const [remise, setRemise] = useState(0);
  const [avecAcompte, setAvecAcompte] = useState(true);
  const [envoyer, setEnvoyer] = useState(true);
  const [route, setRoute] = useState<
    { distanceKm: number; frais: number | null; horsBareme: boolean } | null
  >(null);
  const [routeEnCours, setRouteEnCours] = useState(false);
  const [routeErreur, setRouteErreur] = useState<string | null>(null);

  const pack = useMemo(() => packs.find((p) => p.id === packId), [packs, packId]);
  const tarif = useMemo(() => pack?.tarifs.find((t) => t.categorie === categorie), [pack, categorie]);
  const prixOptions = options.filter((o) => optionIds.includes(o.id)).reduce((total, o) => total + Number(o.prix), 0);
  const arrondi = (v: number) => Math.round(v * 100) / 100;
  const base = tarif ? Number(tarif.prix) + prixOptions : null;
  const montantRemise = base != null ? arrondi((base * remise) / 100) : null;
  const frais = route?.frais ?? 0;
  // Affichage seulement : le serveur recalcule tout, le navigateur n'engage rien.
  const prixTotal = base != null ? arrondi(base - (montantRemise ?? 0) + frais) : null;
  const acompte = prixTotal != null && avecAcompte ? arrondi(prixTotal * 0.1) : 0;

  /** Frais de route, dès que l'adresse est renseignée. */
  async function calculerRoute(adresse: string, ville: string, codePostal: string) {
    if (!adresse.trim() || !ville.trim()) return;
    setRouteEnCours(true);
    setRouteErreur(null);
    const params = new URLSearchParams({ adresse, ville, codePostal });
    const res = await fetch(`/api/deplacement?${params}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setRouteEnCours(false);
    if (!res?.ok) {
      setRoute(null);
      setRouteErreur(data?.error ?? "Calcul impossible.");
      return;
    }
    setRoute(data);
  }

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
         codePostal: donnees.get("codePostal") || undefined,
         categorieVehicule: categorie,
         packId,
         optionIds,
         remisePourcent: remise,
         fraisDeplacement: frais,
         avecAcompte,
         envoyer,
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
       // Un e-mail en échec ne doit pas disparaître derrière une redirection :
       // la direction croirait le prospect joignable alors qu'il n'a rien reçu.
       if (devis.envoi && devis.envoi.envoye === false) {
         setEchecEnvoi({ id: devis.id, erreur: devis.envoi.erreur ?? "raison non précisée" });
         return;
       }
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
          <span className="text-[var(--muted)]">Prénom et nom</span>
          <input name="nomClient" required placeholder="Camille Durand" className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
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
        <span className="text-[var(--muted)]">E-mail{envoyer ? "" : " (optionnel)"}</span>
        <input name="emailClient" type="email" required={envoyer} className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Adresse</span>
          <input name="adresse" required className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Code postal</span>
          <input name="codePostal" inputMode="numeric" placeholder="33000" className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Ville</span>
          <input name="ville" required className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm" />
        </label>
      </div>

      {/*
        Le calcul est déclenché à la demande, pas à chaque frappe : il appelle
        un géocodeur et un calculateur d'itinéraires, et une requête par
        caractère saisi les saturerait pour rien.
      */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          disabled={routeEnCours}
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (!form) return;
            const d = new FormData(form);
            calculerRoute(String(d.get("adresse") ?? ""), String(d.get("ville") ?? ""), String(d.get("codePostal") ?? ""));
          }}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] disabled:opacity-50"
        >
          {routeEnCours ? "Calcul…" : "Calculer les frais de route"}
        </button>

        {route && !route.horsBareme && (
          <span className="text-[var(--success)]">
            {route.distanceKm.toLocaleString("fr-FR")} km depuis Pompignac — frais {route.frais === 0 ? "offerts" : `${route.frais} €`}
          </span>
        )}
        {route?.horsBareme && (
          <span className="text-[var(--warning)]">
            {route.distanceKm.toLocaleString("fr-FR")} km : hors barème, à chiffrer au cas par cas.
          </span>
        )}
        {routeErreur && <span className="text-[var(--danger)]">{routeErreur}</span>}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Remise commerciale</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={remise}
              onChange={(e) => setRemise(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-24 rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm"
            />
            <span className="text-[var(--muted)]">%</span>
          </div>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">Acompte</span>
          <label className="flex items-center gap-2 py-2">
            <input type="checkbox" checked={avecAcompte} onChange={(e) => setAvecAcompte(e.target.checked)} />
            Demander 10 % à la réservation
          </label>
        </div>
      </div>

      <div className="rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-3 py-3 text-sm flex flex-col gap-1">
        {tarif ? (
          <>
            <Ligne libelle="Prestation et options" valeur={`${base} €`} />
            {remise > 0 && <Ligne libelle={`Remise ${remise} %`} valeur={`− ${montantRemise} €`} />}
            {route && (
              <Ligne
                libelle={`Déplacement ${route.distanceKm.toLocaleString("fr-FR")} km`}
                valeur={route.horsBareme ? "hors barème" : frais === 0 ? "offert" : `+ ${frais} €`}
              />
            )}
            <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-2">
              <span>Total</span>
              <strong>{prixTotal} €</strong>
            </div>
            <span className="text-[var(--muted)]">
              {avecAcompte ? `Acompte (10 %) : ${acompte} €` : "Sans acompte — le solde est réglé après la prestation."}
            </span>
            {route?.horsBareme && (
              <span className="text-[var(--warning)]">
                Au-delà du barème : les frais ne sont pas inclus, chiffrez-les à part.
              </span>
            )}
          </>
          ) : (
            <span className="text-[var(--warning)]">Tarif non paramétré pour ce pack et cette catégorie.</span>
          )}
        </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={envoyer} onChange={(e) => setEnvoyer(e.target.checked)} />
        Envoyer le devis au client par e-mail dès sa création
      </label>

        {erreur && <p className="text-sm text-[var(--danger)]">{erreur}</p>}
        {echecEnvoi && (
          <div className="rounded-md border border-[var(--warning)] bg-[var(--warning)]/10 p-3 text-sm">
            <p className="font-medium text-[var(--warning)]">Le devis est enregistré, mais l&apos;e-mail n&apos;est pas parti.</p>
            <p className="mt-1 text-[var(--muted)]">Raison donnée : {echecEnvoi.erreur}</p>
            <p className="mt-1">
              Le prospect n&apos;a rien reçu. Transmettez-lui le lien du devis, ou corrigez la
              configuration d&apos;envoi puis renvoyez-le depuis sa fiche.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/back-office/devis/${echecEnvoi.id}`)}
              className="mt-2 underline"
            >
              Ouvrir le devis
            </button>
          </div>
        )}

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

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted)]">{libelle}</span>
      <span>{valeur}</span>
    </div>
  );
}
