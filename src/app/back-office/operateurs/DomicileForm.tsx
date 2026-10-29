"use client";

// Adresse de domicile de l'opérateur. Ce n'est pas un détail administratif :
// c'est le point de départ de ses trajets. Sans elle, le moteur
// d'affectation l'ignore purement et simplement.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DomicileForm({
  operateurId,
  adresseDomicile,
  geocode,
}: {
  operateurId: string;
  adresseDomicile: string | null;
  geocode: boolean;
}) {
  const router = useRouter();
  const [adresse, setAdresse] = useState(adresseDomicile ?? "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modifie = adresse.trim() !== (adresseDomicile ?? "");

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    const res = await fetch(`/api/operateurs/${operateurId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adresseDomicile: adresse.trim() }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.error ?? "Échec de l'enregistrement.");
      return;
    }
    const maj = await res.json().catch(() => null);
    if (maj && maj.latitudeDomicile == null && adresse.trim()) {
      setErreur("Adresse enregistrée, mais non reconnue par la Base Adresse Nationale : l'opérateur reste inaffectable tant qu'elle n'est pas corrigée.");
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder="Adresse de domicile"
          aria-label="Adresse de domicile"
          className="w-56 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
        />
        {modifie && (
          <button
            onClick={enregistrer}
            disabled={enCours}
            className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
          >
            {enCours ? "…" : "OK"}
          </button>
        )}
      </div>
      {!geocode && !modifie && (
        <p className="text-xs text-[var(--warning)]">
          {adresseDomicile
            ? "Adresse non reconnue : cet opérateur ne peut pas être affecté."
            : "Sans adresse, cet opérateur ne peut pas être affecté."}
        </p>
      )}
      {erreur && <p className="text-xs text-[var(--warning)]">{erreur}</p>}
    </div>
  );
}
