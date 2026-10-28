"use client";

import { useRef, useState } from "react";
import { LIBELLE_ANGLE_PHOTO, type AnglePhoto, type PhotoPrestation } from "@/lib/types";

// Prise de vue réelle : chaque tuile ouvre l'appareil photo du téléphone
// (`capture="environment"` vise la caméra arrière). L'image part vers le
// stockage privé, et l'angle n'est coché qu'une fois le dépôt confirmé par
// le serveur — seule source de vérité pour débloquer l'étape suivante.
//
// La vignette est servie par une route qui vérifie l'appelant, jamais par
// une URL publique : ces clichés montrent une plaque devant un domicile.
export default function PhotoTiles({
  photos,
  rdvId,
  etape,
  onPhoto,
  disabled,
}: {
  photos: PhotoPrestation[];
  rdvId: string;
  etape: "avant" | "apres";
  onPhoto: (angle: AnglePhoto, fichier: File) => Promise<string | null>;
  disabled?: boolean;
}) {
  const [enCours, setEnCours] = useState<AnglePhoto | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champs = useRef<Partial<Record<AnglePhoto, HTMLInputElement | null>>>({});

  async function envoyer(angle: AnglePhoto, fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    setEnCours(angle);
    const message = await onPhoto(angle, fichier);
    if (message) setErreur(message);
    setEnCours(null);
    // On vide le champ : reprendre le même fichier doit redéclencher l'envoi.
    const champ = champs.current[angle];
    if (champ) champ.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo) => {
          const occupe = disabled || enCours !== null;
          return (
            <div
              key={photo.angle}
              className={`rounded-md border p-3 flex flex-col items-center gap-2 text-center ${
                photo.prise
                  ? "border-[var(--success)] bg-[var(--surface-2)]"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {photo.prise && photo.chemin ? (
                /* eslint-disable-next-line @next/next/no-img-element -- flux privé, pas d'optimisation possible */
                <img
                  src={`/api/photos/${rdvId}/${etape}/${photo.angle.toLowerCase()}`}
                  alt={`${LIBELLE_ANGLE_PHOTO[photo.angle]} — ${etape === "avant" ? "avant" : "après"} prestation`}
                  className="h-20 w-full rounded object-cover"
                />
              ) : (
                <span className="text-2xl">{photo.prise ? "✅" : "📷"}</span>
              )}

              <p className="text-xs font-medium">{LIBELLE_ANGLE_PHOTO[photo.angle]}</p>

              <label
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  occupe
                    ? "bg-[var(--surface-2)] text-[var(--chrome)]/50"
                    : "cursor-pointer bg-[var(--accent)] hover:bg-[var(--accent-2)]"
                }`}
              >
                {enCours === photo.angle ? "Envoi…" : photo.prise ? "Reprendre" : "Prendre la photo"}
                <input
                  ref={(el) => {
                    champs.current[photo.angle] = el;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  disabled={occupe}
                  onChange={(e) => envoyer(photo.angle, e.target.files?.[0])}
                />
              </label>
            </div>
          );
        })}
      </div>

      {erreur && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
