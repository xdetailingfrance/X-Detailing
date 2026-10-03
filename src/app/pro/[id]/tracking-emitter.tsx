"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Émission de la position pendant le trajet (§11).
 *
 * Ce composant n'est monté que lorsque le rendez-vous est à l'état `EN_ROUTE`, et le
 * serveur refuse de toute façon tout ping hors trajet. Il s'arrête donc pour deux
 * raisons indépendantes — c'est voulu : la confidentialité ne doit pas reposer sur le
 * bon comportement du téléphone.
 *
 * L'opérateur voit en permanence que le partage est actif : le §31 impose une
 * information adéquate, pas un partage silencieux.
 */

const PING_INTERVAL_MS = 15_000;

type Status = "starting" | "sharing" | "denied" | "stopped";

export function TrackingEmitter({
  appointmentId,
  onArrivingSoon,
}: {
  appointmentId: string;
  onArrivingSoon: (value: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("starting");
  const [eta, setEta] = useState<string | null>(null);
  const [remainingKm, setRemainingKm] = useState<number | null>(null);

  // Dernière position connue, poussée par `watchPosition` et lue par l'envoi périodique.
  const latest = useRef<GeolocationPosition | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    let watchId: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function send() {
      const position = latest.current;
      if (!position || stopped.current) return;

      try {
        const response = await fetch("/api/pro/tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyM: position.coords.accuracy ?? null,
            headingDeg: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
            speedKph: Number.isFinite(position.coords.speed)
              ? Math.round((position.coords.speed ?? 0) * 3.6)
              : null,
          }),
        });

        const data = await response.json();

        // Le serveur peut demander l'arrêt : arrivée validée, rendez-vous annulé…
        if (data?.stopTracking) {
          stopped.current = true;
          setStatus("stopped");
          return;
        }

        if (data?.ok) {
          setEta(data.etaAt ?? null);
          setRemainingKm(typeof data.remainingKm === "number" ? data.remainingKm : null);
          onArrivingSoon(Boolean(data.arrivingSoon));
        }
      } catch {
        // Perte de réseau : on réessaiera au tick suivant, sans rien signaler.
      }
    }

    // Démarrage dans une fonction asynchrone : l'état ne doit pas être écrit
    // pendant l'exécution de l'effet lui-même.
    async function boot() {
      if (!navigator.geolocation) {
        setStatus("denied");
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          latest.current = position;
          setStatus((previous) => (previous === "starting" ? "sharing" : previous));
        },
        () => setStatus("denied"),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
      );

      await send();
      timer = setInterval(send, PING_INTERVAL_MS);
    }

    void boot();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) clearInterval(timer);
    };
  }, [appointmentId, onArrivingSoon]);

  const etaLabel = eta
    ? new Date(eta).toLocaleTimeString("fr-FR", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-xl border border-night-700 bg-night-850 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span
          className={`size-2 rounded-full ${
            status === "sharing"
              ? "animate-pulse bg-xd-ok"
              : status === "denied"
                ? "bg-xd-warn"
                : "bg-chrome-500"
          }`}
          aria-hidden
        />
        <p className="text-sm text-chrome-300">
          {status === "sharing" && "Position partagée avec le client et le central"}
          {status === "starting" && "Recherche du signal GPS…"}
          {status === "denied" && "Position indisponible — activez la localisation"}
          {status === "stopped" && "Partage de position arrêté"}
        </p>
      </div>

      {(etaLabel || remainingKm !== null) && (
        <p className="tabular mt-2 border-t border-night-700 pt-2 text-sm text-chrome-400">
          {remainingKm !== null && <>Reste {remainingKm} km</>}
          {etaLabel && (
            <>
              {remainingKm !== null && " · "}
              arrivée estimée <strong className="font-semibold text-white">{etaLabel}</strong>
            </>
          )}
        </p>
      )}

      <p className="mt-2 text-xs text-chrome-500">
        Le partage s&apos;arrête automatiquement dès que vous validez votre arrivée.
      </p>
    </div>
  );
}
