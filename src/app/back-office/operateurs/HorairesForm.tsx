"use client";

// Les horaires décident des créneaux proposés sur le site : une journée qui
// s'arrête trop tôt ferme le dernier départ. Ils se règlent donc ici, sans
// passer par la base.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HorairesForm({
  operateurId,
  heureDebut,
  heureFin,
}: {
  operateurId: string;
  heureDebut: string;
  heureFin: string;
}) {
  const router = useRouter();
  const [debut, setDebut] = useState(heureDebut);
  const [fin, setFin] = useState(heureFin);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modifie = debut !== heureDebut || fin !== heureFin;

  async function enregistrer() {
    setEnCours(true);
    setErreur(null);
    const res = await fetch(`/api/operateurs/${operateurId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heureDebut: debut, heureFin: fin }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.error ?? "Échec de l'enregistrement.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="time"
          value={debut}
          onChange={(e) => setDebut(e.target.value)}
          aria-label="Début de journée"
          className="w-[6.5rem] rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
        />
        <span className="text-[var(--muted)]">–</span>
        <input
          type="time"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          aria-label="Fin de journée"
          className="w-[6.5rem] rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
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
      {erreur && <p className="text-xs text-[var(--warning)]">{erreur}</p>}
    </div>
  );
}
