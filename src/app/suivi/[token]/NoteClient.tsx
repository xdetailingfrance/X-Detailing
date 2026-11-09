"use client";

import { useState } from "react";

// Note de satisfaction client (1 à 5) — facultative, envoyée une seule fois.
export default function NoteClient({ token, noteInitiale }: { token: string; noteInitiale: number | null }) {
  const [note, setNote] = useState<number | null>(noteInitiale);
  const [envoi, setEnvoi] = useState(false);
  const [survol, setSurvol] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

   async function noter(valeur: number) {
     if (note != null || envoi) return;
        setEnvoi(true);
        setErreur(null);
        try {
          const res = await fetch(`/api/suivi/${token}/note`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: valeur }),
          });
          const data = await res.json().catch(() => ({}));
          // Un clic qui ne produit rien passe pour un bouton cassé : la
          // raison du refus s'affiche plutôt que de disparaître.
          if (!res.ok) setErreur(data.error ?? "Votre note n'a pas pu être enregistrée. Réessayez.");
          else setNote(valeur);
        } catch {
          setErreur("Votre note n'a pas pu être envoyée. Vérifiez votre connexion.");
        } finally {
          setEnvoi(false);
        }
    }

    if (note != null) {
      return <p className="text-sm text-[var(--muted)]">Merci pour votre note : {"  ⭐".repeat(note)}</p>;
    }

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Comment s&apos;est passée votre prestation ?</p>
        <div className="flex gap-1" onMouseLeave={() => setSurvol(0)}>
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => noter(v)}
              onMouseEnter={() => setSurvol(v)}
              onFocus={() => setSurvol(v)}
              disabled={envoi}
              // Toujours en couleur : des étoiles grisées par défaut passent
              // pour désactivées, et sur mobile il n'y a pas de survol pour
              // les rallumer. Le survol ne fait qu'éteindre celles au-delà.
              className={`text-2xl transition hover:scale-110 disabled:opacity-50 ${
                survol > 0 && v > survol ? "opacity-35" : ""
              }`}
              aria-label={`${v} étoile${v > 1 ? "s" : ""} sur 5`}
            >
                ⭐
            </button>
          ))}
        </div>
        {envoi && <p className="text-xs text-[var(--muted)]">Envoi…</p>}
        {erreur && <p className="text-sm text-[var(--warning)]">{erreur}</p>}
      </div>
    );
}

