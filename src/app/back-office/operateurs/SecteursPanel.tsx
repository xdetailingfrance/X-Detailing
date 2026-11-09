"use client";

// Périmètres d'intervention. C'est ici que se décide, sans validation
// humaine, à quel opérateur revient un rendez-vous : celui dont le secteur
// contient l'adresse du client.
import { useState } from "react";
import { useRouter } from "next/navigation";

export type SecteurLigne = {
  id: string;
  nom: string;
  ville: string | null;
  rayonKm: number | null;
  bareme: string;
  couvert: boolean;
  operateurs: string[];
};

export default function SecteursPanel({ secteurs }: { secteurs: SecteurLigne[] }) {
  const router = useRouter();
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function appeler(cle: string, url: string, init: RequestInit) {
    setEnCours(cle);
    setErreur(null);
    const res = await fetch(url, init);
    setEnCours(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.error ?? "Action impossible.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Secteurs et périmètres</h2>
        <p className="text-sm text-[var(--muted)] mt-0.5">
          Un rendez-vous est attribué automatiquement à l&apos;opérateur dont le secteur couvre l&apos;adresse du
          client, et les frais de déplacement se comptent depuis le centre de ce secteur, à son propre barème. Tant
          qu&apos;aucun périmètre n&apos;est renseigné et qu&apos;un seul opérateur est actif, tout lui revient au
          barème par défaut.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
            <tr>
              <th className="px-4 py-2">Secteur</th>
              <th className="px-4 py-2">Ville au centre</th>
              <th className="px-4 py-2">Rayon</th>
              <th className="px-4 py-2">Barème (km:€)</th>
              <th className="px-4 py-2">Opérateur(s)</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {secteurs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)]">
                  Aucun secteur. Créez-en un pour couvrir une nouvelle ville.
                </td>
              </tr>
            )}
            {secteurs.map((s) => (
              <LigneSecteur
                key={s.id}
                secteur={s}
                enCours={enCours === s.id}
                onEnregistrer={(ville, rayonKm, bareme) =>
                  appeler(s.id, `/api/secteurs/${s.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ville, rayonKm, bareme }),
                  })
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          placeholder="Nouveau secteur (ex. Toulouse)"
          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
        />
        <button
          onClick={async () => {
            if (!nouveau.trim()) return;
            const ok = await appeler("nouveau", "/api/secteurs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ nom: nouveau.trim() }),
            });
            if (ok) setNouveau("");
          }}
          disabled={!nouveau.trim() || enCours === "nouveau"}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
        >
          {enCours === "nouveau" ? "Création…" : "Ajouter un secteur"}
        </button>
      </div>

      {erreur && <p className="text-sm text-[var(--warning)]">{erreur}</p>}
    </section>
  );
}

function LigneSecteur({
  secteur,
  enCours,
  onEnregistrer,
}: {
  secteur: SecteurLigne;
  enCours: boolean;
  onEnregistrer: (ville: string, rayonKm: string, bareme: string) => Promise<boolean>;
}) {
  const [ville, setVille] = useState(secteur.ville ?? "");
  const [rayon, setRayon] = useState(secteur.rayonKm != null ? String(secteur.rayonKm) : "");
  const [bareme, setBareme] = useState(secteur.bareme);
  const modifie =
    ville.trim() !== (secteur.ville ?? "") ||
    rayon !== (secteur.rayonKm != null ? String(secteur.rayonKm) : "") ||
    bareme.trim() !== secteur.bareme;

  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-4 py-2 align-top">{secteur.nom}</td>
      <td className="px-4 py-2 align-top">
        <input
          value={ville}
          onChange={(e) => setVille(e.target.value)}
          placeholder="Toulouse"
          aria-label={`Ville au centre du secteur ${secteur.nom}`}
          className="w-40 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
        />
      </td>
      <td className="px-4 py-2 align-top">
        <div className="flex items-center gap-1">
          <input
            value={rayon}
            onChange={(e) => setRayon(e.target.value)}
            inputMode="numeric"
            placeholder="30"
            aria-label={`Rayon du secteur ${secteur.nom} en kilomètres`}
            className="w-20 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
          />
          <span className="text-[var(--muted)]">km</span>
        </div>
      </td>
      <td className="px-4 py-2 align-top">
        <input
          value={bareme}
          onChange={(e) => setBareme(e.target.value)}
          placeholder="10:0, 20:10, 30:15"
          aria-label={`Barème de déplacement du secteur ${secteur.nom}`}
          className="w-44 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
        />
        <span className="block text-xs text-[var(--muted)]">vide = barème par défaut</span>
      </td>
      <td className="px-4 py-2 align-top">
        {secteur.operateurs.length > 0 ? (
          secteur.operateurs.join(", ")
        ) : (
          <span className="text-[var(--muted)]">aucun</span>
        )}
        {!secteur.couvert && (
          <span className="block text-xs text-[var(--muted)]">périmètre non défini — n&apos;attrape rien</span>
        )}
      </td>
      <td className="px-4 py-2 align-top text-right">
        {modifie && (
          <button
            onClick={() => onEnregistrer(ville.trim(), rayon.trim(), bareme.trim())}
            disabled={enCours}
            className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
          >
            {enCours ? "…" : "OK"}
          </button>
        )}
      </td>
    </tr>
  );
}
