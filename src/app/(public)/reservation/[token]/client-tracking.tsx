"use client";

import { useEffect, useState } from "react";
import { LiveMap, type MapLink, type MapMarker } from "@/components/live-map";
import type { ClientTracking } from "@/server/tracking";

/**
 * Suivi du trajet côté client (§11).
 *
 * « Le client voit que son opérateur est en route, sa position, la distance restante et
 * une ETA. » Rien de plus : ni le nom complet de l'opérateur, ni sa tournée, ni sa
 * position en dehors de ce trajet (§31).
 */

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ClientTrackingPanel({
  token,
  initial,
}: {
  token: string;
  initial: ClientTracking;
}) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (initial.status !== "EN_ROUTE") return;

    const source = new EventSource(`/api/track/${token}`);
    source.onmessage = (event) => {
      try {
        setState(JSON.parse(event.data) as ClientTracking);
      } catch {
        // Trame incomplète : on conserve le dernier état connu.
      }
    };

    return () => source.close();
  }, [token, initial.status]);

  if (state.status !== "EN_ROUTE") return null;

  const markers: MapMarker[] = [
    {
      id: "destination",
      lat: state.destination.lat,
      lng: state.destination.lng,
      kind: "destination",
      label: "Votre adresse",
    },
  ];
  const links: MapLink[] = [];

  if (state.position) {
    markers.unshift({
      id: "operator",
      lat: state.position.lat,
      lng: state.position.lng,
      kind: "operator",
      label: state.operatorFirstName ?? "Votre opérateur",
      sublabel: "En route",
    });
    links.push({
      from: [state.position.lat, state.position.lng],
      to: [state.destination.lat, state.destination.lng],
    });
  }

  const name = state.operatorFirstName ?? "Votre opérateur";

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-brand-700 bg-brand-600/10">
      <div className="px-5 py-4">
        <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.16em] text-brand-400">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-400" />
          En route
        </p>

        <h2 className="font-display mt-2 text-xl font-extrabold tracking-tight text-white">
          {state.arrivingSoon ? `${name} arrive` : `${name} est en route`}
        </h2>

        <p className="tabular mt-1.5 text-sm text-chrome-300">
          {state.etaAt && (
            <>
              Arrivée estimée à{" "}
              <strong className="font-semibold text-white">{clock(state.etaAt)}</strong>
            </>
          )}
          {state.remainingKm !== null && (
            <>
              {state.etaAt && " · "}
              {state.remainingKm} km restants
            </>
          )}
        </p>

        {state.arrivingSoon && (
          <p className="mt-2 text-sm text-xd-ok">
            {/* Pas de distance chiffrée ici : elle dériverait du seuil serveur au
                premier ajustement. */}
            Il est tout proche — pensez à dégager l&apos;accès au véhicule.
          </p>
        )}
      </div>

      {state.position ? (
        <LiveMap markers={markers} links={links} className="h-64 w-full" />
      ) : (
        <p className="border-t border-brand-700 px-5 py-4 text-sm text-chrome-400">
          Position en cours d&apos;acquisition…
        </p>
      )}
    </section>
  );
}
