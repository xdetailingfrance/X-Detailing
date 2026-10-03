"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LiveMap, type MapLink, type MapMarker } from "@/components/live-map";
import type { NetworkTracking } from "@/server/tracking";

/**
 * Vue temps réel du réseau (§20).
 *
 * Le flux SSE pousse l'état complet toutes les cinq secondes. Renvoyer l'état entier
 * plutôt que des deltas évite toute désynchronisation après une coupure réseau, pour un
 * volume négligeable à cette échelle.
 */

const STATUS_LABEL: Record<string, { label: string; tone: string; dot: string }> = {
  IDLE: { label: "Disponible", tone: "text-ink-500", dot: "bg-xd-steel" },
  EN_ROUTE: { label: "En trajet", tone: "text-brand-700", dot: "bg-brand-600 animate-pulse" },
  ARRIVED: { label: "Arrivé", tone: "text-violet-700", dot: "bg-violet-500" },
  PHOTOS_BEFORE: { label: "Photos avant", tone: "text-violet-700", dot: "bg-violet-500" },
  IN_PROGRESS: { label: "Prestation en cours", tone: "text-violet-700", dot: "bg-violet-500" },
  PHOTOS_AFTER: { label: "Photos après", tone: "text-violet-700", dot: "bg-violet-500" },
  PAYMENT: { label: "Encaissement", tone: "text-xd-warn", dot: "bg-xd-warn" },
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Au-delà de l'heure, « +122 min » ne se lit plus. */
function lateLabel(minutes: number): string {
  if (minutes < 60) return `+${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `+${hours} h` : `+${hours} h ${String(rest).padStart(2, "0")}`;
}

export function NetworkMap({ initial }: { initial: NetworkTracking }) {
  const [state, setState] = useState(initial);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/admin/live");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      try {
        setState(JSON.parse(event.data) as NetworkTracking);
        setConnected(true);
      } catch {
        // Trame incomplète : on garde l'état précédent plutôt que d'effacer la carte.
      }
    };

    return () => source.close();
  }, []);

  const { markers, links } = useMemo(() => {
    const markers: MapMarker[] = [];
    const links: MapLink[] = [];

    for (const operator of state.operators) {
      if (operator.position) {
        markers.push({
          id: `op-${operator.operatorId}`,
          lat: operator.position.lat,
          lng: operator.position.lng,
          kind: operator.status === "IDLE" ? "idle" : "operator",
          label: operator.name,
          sublabel:
            operator.status === "IDLE"
              ? "Disponible — position de rattachement"
              : (STATUS_LABEL[operator.status]?.label ?? operator.status),
        });
      }

      if (operator.current) {
        markers.push({
          id: `rdv-${operator.current.appointmentId}`,
          lat: operator.current.lat,
          lng: operator.current.lng,
          kind: "destination",
          label: operator.current.customer || operator.current.reference,
          sublabel: `${operator.current.city} · ${clock(operator.current.scheduledStart)}`,
        });

        if (operator.status === "EN_ROUTE" && operator.position) {
          links.push({
            from: [operator.position.lat, operator.position.lng],
            to: [operator.current.lat, operator.current.lng],
          });
        }
      }
    }

    return { markers, links };
  }, [state]);

  const enRoute = state.operators.filter((o) => o.status === "EN_ROUTE").length;
  const working = state.operators.filter(
    (o) => o.status !== "IDLE" && o.status !== "EN_ROUTE",
  ).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-xl m-polished">
        <LiveMap markers={markers} links={links} className="h-[520px] w-full" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          <span>
            {enRoute} en trajet · {working} en prestation · mise à jour {clock(state.at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${connected ? "bg-xd-ok" : "bg-xd-warn"}`}
            />
            {connected ? "flux en direct" : "reconnexion…"}
          </span>
        </div>
      </div>

      <div className="rounded-xl m-polished">
        <h2 className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800">
          Opérateurs
        </h2>

        <ul className="divide-y divide-ink-100">
          {state.operators.map((operator) => {
            const status = STATUS_LABEL[operator.status] ?? {
              label: operator.status,
              tone: "text-ink-500",
              dot: "bg-xd-steel",
            };
            const late = operator.current?.lateMin ?? null;

            return (
              <li key={operator.operatorId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/admin/operateurs/${operator.operatorId}`}
                    className="text-sm font-medium text-ink-900 hover:text-brand-600"
                  >
                    {operator.name}
                  </Link>
                  <span className={`inline-flex items-center gap-1.5 text-xs ${status.tone}`}>
                    <span className={`size-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {operator.current ? (
                  <div className="mt-1 text-xs text-ink-500">
                    <Link
                      href={`/admin/rendez-vous/${operator.current.appointmentId}`}
                      className="hover:text-brand-600"
                    >
                      {operator.current.customer || operator.current.reference}
                    </Link>
                    {" · "}
                    {operator.current.city}
                    {/* L'heure d'arrivée estimée n'a de sens que pendant le trajet :
                        une fois sur place, elle ne fait que vieillir. */}
                    {operator.status === "EN_ROUTE" && operator.current.etaAt && (
                      <>
                        {" · arrivée "}
                        <span className={late !== null && late > 10 ? "font-medium text-xd-danger" : ""}>
                          {clock(operator.current.etaAt)}
                          {late !== null && late > 10 && ` (${lateLabel(late)})`}
                        </span>
                      </>
                    )}
                    {operator.status !== "EN_ROUTE" && (
                      <>{" · prévu à "}{clock(operator.current.scheduledStart)}</>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-400">Aucune prestation en cours.</p>
                )}

                {operator.next && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    Puis {clock(operator.next.scheduledStart)} · {operator.next.city}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          Les opérateurs hors trajet sont affichés à leur point de rattachement : le GPS ne
          tourne que pendant un trajet (§11).
        </p>
      </div>
    </div>
  );
}
