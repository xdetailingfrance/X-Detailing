"use client";

import { useState } from "react";

// Note de satisfaction client (1 à 5) — facultative, envoyée une seule fois.
export default function NoteClient({
  token,
  noteInitiale,
  avisGoogle,
}: {
  token: string;
  noteInitiale: number | null;
  avisGoogle: string;
}) {
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

    // Le lien Google est proposé à tout le monde, quelle que soit la note.
    // Ne le montrer qu'aux clients satisfaits serait du tri d'avis, que
    // Google interdit — et qui fausse ce que la fiche raconte.
    const lienGoogle = (
      <a
        href={avisGoogle}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 self-start rounded-md border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--surface-2)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 01-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
          <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.6-2-6.5-4.8H1.6v3C3.5 21.3 7.5 24 12 24z" />
          <path fill="#FBBC05" d="M5.5 14.6a7.2 7.2 0 010-4.6v-3H1.6a12 12 0 000 10.6l3.9-3z" />
          <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.5 0 3.5 2.7 1.6 6.6l3.9 3c.9-2.8 3.5-4.8 6.5-4.8z" />
        </svg>
        Laisser un avis Google
      </a>
    );

    if (note != null) {
      return (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">Merci pour votre note : {"  ⭐".repeat(note)}</p>
          <p className="text-sm">Un mot sur Google aiderait beaucoup — cela prend une minute.</p>
          {lienGoogle}
        </div>
      );
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
        <div className="mt-1 border-t border-[var(--border)] pt-3">{lienGoogle}</div>
      </div>
    );
}

