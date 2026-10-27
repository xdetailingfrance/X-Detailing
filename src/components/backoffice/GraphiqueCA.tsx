"use client";

import { useState } from "react";

// CA réservé et réalisé par période : barres groupées sur un seul axe,
// infobulle au survol, légende, et vue tableau pour l'accessibilité.
// Couleurs validées (contraste et daltonisme) sur la surface sombre.
const COULEURS = { reserve: "#8b5cf6", realise: "#0d9488" };

type Point = { libelle: string; reserve: number; realise: number };

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function graduations(max: number) {
  if (max <= 0) return [0];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut;
  return Array.from({ length: Math.ceil(max / pas) + 1 }, (_, i) => i * pas);
}

export default function GraphiqueCA({ points, titre }: { points: Point[]; titre: string }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [tableau, setTableau] = useState(false);

    const L = 720;
    const H = 240;
    const marge = { haut: 12, droite: 8, bas: 28, gauche: 56 };
    const max = Math.max(1, ...points.flatMap((p) => [p.reserve, p.realise]));
    const ticks = graduations(max);
    const haut = ticks[ticks.length - 1] || 1;
    const largeurZone = L - marge.gauche - marge.droite;
    const hauteurZone = H - marge.haut - marge.bas;
    const pas = largeurZone / points.length;
    const barre = Math.min(18, (pas - 10) / 2);
    const y = (v: number) => marge.haut + hauteurZone - (v / haut) * hauteurZone;

  // Barre arrondie (4px) en haut, posée sur la ligne de base.
  const chemin = (x: number, valeur: number) => {
    const h = Math.max(0, (valeur / haut) * hauteurZone);
    if (h === 0) return "";
    const r = Math.min(4, h, barre / 2);
    const base = marge.haut + hauteurZone;
    return `M${x} ${base} V${base - h + r} Q${x} ${base - h} ${x + r} ${base - h} H${x + barre - r} Q${x + barre}${base - h} ${x + barre} ${base - h + r} V${base} Z`;
  };

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-sm font-medium">{titre}</figcaption>
        <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COULEURS.reserve }} /> Réservé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COULEURS.realise }} /> Réalisé
          </span>
          <button type="button" onClick={() => setTableau((t) => !t)} className="underline-offset-2 hover:underline">
            {tableau ? "Voir le graphique" : "Voir le tableau"}
          </button>
        </div>
      </div>

      {tableau ? (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Période</th>
                <th className="px-3 py-2 text-right">Réservé</th>
                <th className="px-3 py-2 text-right">Réalisé</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.libelle} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5">{p.libelle}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euros(p.reserve)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{euros(p.realise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${L} ${H}`} className="w-full" role="img" aria-label={titre} onMouseLeave={() => setSurvol(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={marge.gauche} x2={L - marge.droite} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                <text x={marge.gauche - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
                  {euros(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x0 = marge.gauche + i * pas + (pas - (2 * barre + 2)) / 2;
              return (
                <g key={p.libelle} onMouseEnter={() => setSurvol(i)}>
                  {/* Zone de survol plus large que les barres */}
                  <rect x={marge.gauche + i * pas} y={marge.haut} width={pas} height={hauteurZone} fill={survol === i ? "rgba(255,255,255,0.04)" : "transparent"} />
                  <path d={chemin(x0, p.reserve)} fill={COULEURS.reserve} />
                  <path d={chemin(x0 + barre + 2, p.realise)} fill={COULEURS.realise} />
                  <text x={marge.gauche + i * pas + pas / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {p.libelle}
                  </text>
                </g>
              );
            })}
          </svg>
          {survol !== null && (
            <div
              className="pointer-events-none absolute top-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs shadow-lg"
              style={{ left: `${Math.min(78, ((marge.gauche + (survol + 0.5) * pas) / L) * 100)}%` }}
            >
              <p className="font-medium">{points[survol].libelle}</p>
              <p className="mt-1 flex items-center gap-1.5 tabular-nums">
                <span className="h-2 w-2 rounded-sm" style={{ background: COULEURS.reserve }} /> Réservé : {euros(points[survol].reserve)}
              </p>
              <p className="flex items-center gap-1.5 tabular-nums">
                <span className="h-2 w-2 rounded-sm" style={{ background: COULEURS.realise }} /> Réalisé : {euros(points[survol].realise)}
              </p>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

