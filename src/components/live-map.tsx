"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Carte live (§11, §20).
 *
 * Leaflet piloté directement plutôt que via un wrapper React : la carte est un objet
 * impératif à cycle de vie propre, et un wrapper ajouterait une dépendance à faire
 * suivre à chaque version de React pour aucun gain ici.
 *
 * Fond de carte OpenStreetMap — gratuit, sans compte, cohérent avec le reste du système
 * (§32) tant qu'aucun prestataire cartographique n'est acté.
 */

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "operator" | "destination" | "idle";
  label: string;
  sublabel?: string;
};

export type MapLink = { from: [number, number]; to: [number, number] };

const STYLES: Record<MapMarker["kind"], { background: string; border: string; size: number }> = {
  operator: { background: "#8008f8", border: "#b880f8", size: 22 },
  destination: { background: "#0f172a", border: "#94a3b8", size: 16 },
  idle: { background: "#475569", border: "#94a3b8", size: 14 },
};

/** Déplacement amorti : départ et arrivée lents, milieu rapide. */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export function LiveMap({
  markers,
  links = [],
  className = "",
  zoom = 12,
  autoFit = false,
}: {
  markers: MapMarker[];
  links?: MapLink[];
  className?: string;
  zoom?: number;
  /**
   * Recadre à chaque mise à jour pour garder tous les repères visibles.
   *
   * Utile au client qui suit une seule arrivée ; à proscrire sur la carte du réseau,
   * où un recadrage permanent empêcherait le central de se déplacer sur la carte.
   */
  autoFit?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  /**
   * Les repères persistent d'un rendu à l'autre, identifiés par leur `id`.
   *
   * Les recréer à chaque position ferait sauter le véhicule de point en point toutes
   * les cinq secondes. Conservés, ils glissent — c'est toute la différence entre une
   * carte qui se rafraîchit et un véhicule qui avance.
   */
  const pins = useRef(new Map<string, import("leaflet").Marker>());
  const animations = useRef(new Map<string, number>());
  /** Le cadrage n'est ajusté qu'au premier rendu, sauf si `autoFit` le demande. */
  const framed = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Import dynamique : Leaflet touche `window` dès son évaluation.
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || map.current) return;

      map.current = L.map(container.current, { attributionControl: true }).setView(
        [45.764, 4.8357],
        zoom,
      );

      // Les tuiles restent celles d'OpenStreetMap — aucun service supplémentaire, aucune
      // clé — et c'est le rendu qui les passe en graphite : voir `.leaflet-tile-pane`
      // dans globals.css. Un fond de carte clair au milieu d'une application noire est
      // le seul endroit où le regard tombe sur du blanc (§51, PASS 6).
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current);

      layer.current = L.layerGroup().addTo(map.current);
      draw(L);
    }

    /** Fait glisser un repère vers sa nouvelle position, au lieu de l'y téléporter. */
    function glide(marker: import("leaflet").Marker, lat: number, lng: number) {
      const from = marker.getLatLng();
      if (Math.abs(from.lat - lat) < 1e-7 && Math.abs(from.lng - lng) < 1e-7) return;

      const id = marker.options.title ?? "";
      const existing = animations.current.get(id);
      if (existing) cancelAnimationFrame(existing);

      const startedAt = performance.now();
      // 1,4 s : un peu moins que l'intervalle des positions, pour que le mouvement
      // s'achève avant la suivante plutôt que de se faire couper.
      const duration = 1400;

      const step = (now: number) => {
        const t = Math.min(1, (now - startedAt) / duration);
        const k = easeInOut(t);
        marker.setLatLng([from.lat + (lat - from.lat) * k, from.lng + (lng - from.lng) * k]);
        if (t < 1) animations.current.set(id, requestAnimationFrame(step));
        else animations.current.delete(id);
      };

      animations.current.set(id, requestAnimationFrame(step));
    }

    function draw(L: typeof import("leaflet")) {
      if (!map.current || !layer.current) return;

      // Les tracés se redessinent ; les repères, non.
      for (const child of layer.current.getLayers()) {
        if (!(child instanceof L.Marker)) layer.current.removeLayer(child);
      }

      for (const link of links) {
        L.polyline([link.from, link.to], {
          color: "#8008f8",
          weight: 2,
          opacity: 0.5,
          dashArray: "6 6",
        }).addTo(layer.current);
      }

      const seen = new Set<string>();

      for (const marker of markers) {
        seen.add(marker.id);
        const style = STYLES[marker.kind];
        const existing = pins.current.get(marker.id);

        if (existing) {
          glide(existing, marker.lat, marker.lng);
          existing.setTooltipContent(
            `<strong>${marker.label}</strong>${marker.sublabel ? `<br>${marker.sublabel}` : ""}`,
          );
          continue;
        }

        const icon = L.divIcon({
          className: "",
          iconSize: [style.size, style.size],
          iconAnchor: [style.size / 2, style.size / 2],
          html:
            `<span style="display:block;width:${style.size}px;height:${style.size}px;` +
            `border-radius:9999px;background:${style.background};` +
            `border:2px solid ${style.border};box-shadow:0 0 0 3px rgba(128,8,248,.18)"></span>`,
        });

        const created = L.marker([marker.lat, marker.lng], { icon, title: marker.id })
          .bindTooltip(
            `<strong>${marker.label}</strong>${marker.sublabel ? `<br>${marker.sublabel}` : ""}`,
            { direction: "top", offset: [0, -style.size / 2] },
          )
          .addTo(layer.current);

        pins.current.set(marker.id, created);
      }

      // Repères disparus — un opérateur qui termine sa tournée, par exemple.
      for (const [id, pin] of pins.current) {
        if (seen.has(id)) continue;
        pin.remove();
        pins.current.delete(id);
      }

      if ((autoFit || !framed.current) && markers.length > 0) {
        framed.current = true;
        if (markers.length === 1) {
          map.current.setView([markers[0].lat, markers[0].lng], 14);
        } else {
          map.current.fitBounds(
            L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])),
            { padding: [40, 40], maxZoom: 15 },
          );
        }
      }
    }

    if (!map.current) {
      void boot();
    } else {
      void import("leaflet").then(({ default: L }) => draw(L));
    }

    return () => {
      cancelled = true;
    };
  }, [markers, links, zoom, autoFit]);

  // Les animations en cours ne doivent pas survivre au démontage.
  useEffect(() => {
    const running = animations.current;
    return () => {
      for (const frame of running.values()) cancelAnimationFrame(frame);
      running.clear();
    };
  }, []);

  // Démontage réel : séparé de la boucle de dessin, qui tourne à chaque mise à jour.
  useEffect(() => {
    return () => {
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  return <div ref={container} className={className} role="application" aria-label="Carte du réseau" />;
}
