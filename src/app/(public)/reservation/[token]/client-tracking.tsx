"use client";

import { useEffect, useState } from "react";
import { LiveMap, type MapLink, type MapMarker } from "@/components/live-map";
import { BUSINESS, telHref } from "@/lib/business";
import type { ClientTracking } from "@/server/tracking";

/**
 * Suivi du trajet côté client (§11).
 *
 * La carte occupe l'écran, l'information se pose dessus : c'est la disposition qu'on
 * attend d'un suivi d'arrivée, et elle met au premier plan ce que le client veut
 * savoir — dans combien de temps.
 *
 * Le décompte en minutes passe devant l'heure d'arrivée : « dans 7 min » se comprend
 * sans calcul, « à 11 h 38 » demande de regarder l'heure. L'heure reste en second, pour
 * qui veut planifier.
 *
 * Ce qui n'est pas montré l'est délibérément : ni le nom complet de l'opérateur, ni sa
 * tournée, ni sa position hors de ce trajet (§31). Le serveur ne les envoie pas.
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
  const tel = telHref();

  /** Le titre suit la distance, pas l'horloge : c'est ce qui change le comportement. */
  const headline = state.arrivingSoon
    ? `${name} arrive`
    : state.etaMinutes !== null
      ? `${name} arrive dans ${state.etaMinutes} min`
      : `${name} est en route`;

  return (
    <section className="mt-6 overflow-hidden rounded-[--radius-xd-xl] m-polished">
      {/* ── La carte ────────────────────────────────────────────────────── */}
      <div className="relative">
        {state.position ? (
          <LiveMap
            markers={markers}
            links={links}
            autoFit
            className="h-[22rem] w-full sm:h-[26rem]"
          />
        ) : (
          <div className="grid h-[22rem] place-items-center px-6 text-center sm:h-[26rem]">
            <p className="text-meta text-xd-text-3">
              Position en cours d&apos;acquisition…
            </p>
          </div>
        )}

        {/* Bandeau d'état, posé sur la carte. À droite et au-dessus des contrôles
            Leaflet, qui occupent le coin haut-gauche avec un z-index de 1000. */}
        <div className="pointer-events-none absolute right-0 top-0 z-[1100] p-3">
          <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-micro font-semibold uppercase tracking-[0.16em] text-xd-violet-highlight">
            <span className="size-1.5 animate-pulse rounded-full bg-xd-violet-highlight" />
            {state.arrivingSoon ? "Arrivée imminente" : "En route"}
          </p>
        </div>
      </div>

      {/* ── Ce qu'il faut savoir ────────────────────────────────────────── */}
      <div className="hairline-t px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-h3 font-semibold text-xd-text">{headline}</p>
            <p className="tabular mt-1 text-meta text-xd-text-3">
              {state.etaAt && <>Arrivée vers {clock(state.etaAt)}</>}
              {state.remainingKm !== null && (
                <>
                  {state.etaAt && " · "}
                  {state.remainingKm} km
                </>
              )}
            </p>
          </div>

          {/*
            Le décompte en gros chiffres. Masqué à l'approche : afficher « 0 min »
            pendant que l'opérateur se gare est faux et inquiète pour rien.
          */}
          {!state.arrivingSoon && state.etaMinutes !== null && (
            <p className="tabular shrink-0 text-right">
              <span className="text-[2.6rem] font-semibold leading-none tracking-[-0.035em] text-xd-text">
                {state.etaMinutes}
              </span>
              <span className="ml-1 text-meta text-xd-text-3">min</span>
            </p>
          )}
        </div>

        {state.vehicleLabel && (
          <p className="mt-3 text-meta text-xd-text-3">
            Guettez {state.vehicleLabel} aux couleurs {BUSINESS.name}.
          </p>
        )}

        {state.arrivingSoon && (
          <p className="mt-3 text-meta text-xd-ok">
            {/* Pas de distance chiffrée ici : elle dériverait du seuil serveur au
                premier ajustement. */}
            Il est tout proche — pensez à dégager l&apos;accès au véhicule.
          </p>
        )}

        {tel && (
          <a
            href={tel}
            className="press glass glass-interactive mt-4 flex items-center justify-center rounded-full py-3 text-body font-medium text-xd-text"
          >
            Appeler X Detailing
          </a>
        )}
      </div>
    </section>
  );
}
