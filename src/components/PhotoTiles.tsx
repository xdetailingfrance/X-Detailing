"use client";

import { useState } from "react";
import { LIBELLE_ANGLE_PHOTO, type AnglePhoto, type PhotoPrestation } from "@/lib/types";

// Prise de photo simulée (pas d'accès caméra réel) : chaque tuile représente
// un angle obligatoire. « Simuler la photo » marque l'angle comme
// photographié côté serveur, seule source de vérité pour débloquer l'étape
// suivante du workflow.
export default function PhotoTiles({
  photos,
  onSimuler,
  disabled,
}: {
  photos: PhotoPrestation[];
  onSimuler: (angle: AnglePhoto) => Promise<void>;
  disabled?: boolean;
}) {
   const [enCours, setEnCours] = useState<AnglePhoto | null>(null);

   async function simuler(angle: AnglePhoto) {
     setEnCours(angle);
     await onSimuler(angle);
     setEnCours(null);
   }

  return (
    <div className="grid grid-cols-2 gap-2">
      {photos.map((photo) => (
        <div
          key={photo.angle}
          className={`rounded-md border p-3 flex flex-col items-center gap-2 text-center ${
            photo.prise ? "border-[var(--success)] bg-[var(--surface-2)]" : "border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
                                                      ✅      📷<span className="text-2xl">{photo.prise ? " " : " "}</span>
          <p className="text-xs font-medium">{LIBELLE_ANGLE_PHOTO[photo.angle]}</p>
          {!photo.prise && (
            <button
              type="button"
              onClick={() => simuler(photo.angle)}
              disabled={disabled || enCours !== null}
              className="rounded-md bg-[var(--accent)] px-2 py-1 text-xs font-medium hover:bg-[var(--accent-2)] transition disabled:opacity-50"
            >
              {enCours === photo.angle ? "…" : "Simuler la photo"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

