"use client";

import { useEffect, useState } from "react";

// Simulation visuelle d'un GPS live (aucune API de cartographie/localisation
// réelle) : la progression est calculée à partir du temps écoulé depuis
// `demarreAt`, ramené à une durée de trajet raccourcie pour la démo afin que
// l'animation reste lisible sans attendre le vrai ETA.
const DUREE_SIMULEE_MS = 40_000;

export default function GpsLiveSimule({
  demarreAt,
  etaMinutesReel,
  destinationLabel,
}: {
  demarreAt: string;
  etaMinutesReel?: number;
  destinationLabel: string;
}) {
  const [progression, setProgression] = useState(0);

    useEffect(() => {
      const debut = new Date(demarreAt).getTime();
      const tick = () => {
        const ecoule = Date.now() - debut;
        setProgression(Math.min(1, ecoule / DUREE_SIMULEE_MS));
      };
      tick();
      const id = setInterval(tick, 250);
      return () => clearInterval(id);
    }, [demarreAt]);

    const arrive = progression >= 1;
    const secondesRestantes = Math.max(0, Math.ceil(((1 - progression) * DUREE_SIMULEE_MS) / 1000));

    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">GPS live (simulation)</p>
          <span className="text-xs text-[var(--muted)]">
            {arrive ? "Arrivé" : `Arrivée estimée dans ${secondesRestantes}s`}
            {!arrive && etaMinutesReel != null ? ` · trajet réel ≈ ${etaMinutesReel} min` : ""}
          </span>
        </div>
        <svg viewBox="0 0 300 40" className="w-full h-10">
          <line x1="10" y1="20" x2="290" y2="20" stroke="var(--border)" strokeWidth="3" strokeDasharray="6 6" />
          <circle cx="10" cy="20" r="5" fill="var(--muted)" />
          <circle cx="290" cy="20" r="5" fill="var(--accent)" />
          <g style={{ transform: `translateX(${10 + progression * 270}px)`, transition: "transform 250ms linear" }}>
                                             🚐<text x="-8" y="6" fontSize="16"> </text>
          </g>
        </svg>
        <p className="text-xs text-[var(--muted)]">Destination : {destinationLabel}</p>
      </div>
    );
}

