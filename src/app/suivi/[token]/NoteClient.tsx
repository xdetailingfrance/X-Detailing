"use client";

import { useState } from "react";

// Note de satisfaction client (1 à 5) — facultative, envoyée une seule fois.
export default function NoteClient({ token, noteInitiale }: { token: string; noteInitiale: number | null }) {
  const [note, setNote] = useState<number | null>(noteInitiale);
  const [envoi, setEnvoi] = useState(false);

   async function noter(valeur: number) {
     if (note != null || envoi) return;
        setEnvoi(true);
        const res = await fetch(`/api/suivi/${token}/note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: valeur }),
        });
        setEnvoi(false);
        if (res.ok) setNote(valeur);
    }

    if (note != null) {
      return <p className="text-sm text-[var(--muted)]">Merci pour votre note : {"  ⭐".repeat(note)}</p>;
    }

    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Comment s&apos;est passée votre prestation ?</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              onClick={() => noter(v)}
              disabled={envoi}
              className="text-2xl hover:scale-110 transition disabled:opacity-50"
              aria-label={`${v} étoile(s)`}
            >
                ⭐
            </button>
          ))}
        </div>
      </div>
    );
}

