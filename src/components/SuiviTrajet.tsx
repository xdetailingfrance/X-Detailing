"use client";

import { useEffect, useState } from "react";

/**
 * Suivi du trajet, côté client.
 *
 * Interroge la position réelle de l'opérateur et annonce le temps restant
 * calculé par la route, pas à vol d'oiseau.
 *
 * Le fond de carte est une vue OpenStreetMap intégrée : gratuite, sans clé et
 * sans bibliothèque à charger sur un téléphone qui attend dehors.
 *
 * Tant qu'aucune position n'est arrivée, on le dit au lieu d'animer une
 * progression imaginaire — c'est ce que faisait la version précédente, et un
 * client qui voit une camionnette avancer alors que personne n'a démarré finit
 * par ne plus croire l'écran.
 */
const RAFRAICHISSEMENT_MS = 20_000;

type Position = {
  enRoute: boolean;
  latitude?: number;
  longitude?: number;
  positionAt?: string;
  distanceKm?: number | null;
  minutes?: number | null;
};

export default function SuiviTrajet({
  token,
  destinationLabel,
}: {
  token: string;
  destinationLabel: string;
}) {
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    let vivant = true;
    async function relever() {
      const res = await fetch(`/api/suivi/${encodeURIComponent(token)}/position`, {
        cache: "no-store",
      }).catch(() => null);
      if (!vivant || !res?.ok) return;
      setPosition(await res.json().catch(() => null));
    }
    relever();
    const id = setInterval(relever, RAFRAICHISSEMENT_MS);
    return () => {
      vivant = false;
      clearInterval(id);
    };
  }, [token]);

  const aUnePosition = position?.enRoute && position.latitude != null && position.longitude != null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Votre opérateur arrive</p>
        {aUnePosition && position.minutes != null && (
          <span className="text-sm font-semibold text-[var(--accent)]">
            {position.minutes <= 1 ? "moins d'une minute" : `${position.minutes} min`}
          </span>
        )}
      </div>

      {aUnePosition ? (
        <>
          <iframe
            title="Position de votre opérateur"
            className="w-full rounded border border-[var(--border)]"
            height={220}
            loading="lazy"
            src={cadreCarte(position.latitude!, position.longitude!)}
          />
          <p className="text-xs text-[var(--muted)]">
            {position.distanceKm != null ? `${position.distanceKm.toLocaleString("fr-FR")} km par la route · ` : ""}
            Destination : {destinationLabel}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          En attente de la position de votre opérateur. Destination : {destinationLabel}
        </p>
      )}
    </div>
  );
}

/** Vue centrée sur la position, avec un marqueur — environ 1,5 km de côté. */
function cadreCarte(latitude: number, longitude: number) {
  const marge = 0.008;
  const bbox = [longitude - marge, latitude - marge, longitude + marge, latitude + marge].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}
