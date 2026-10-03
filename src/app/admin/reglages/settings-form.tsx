"use client";

import { FIELD_SURFACE } from "@/components/controls";
import { useActionState, useState } from "react";
import { saveSettings } from "./actions";
import type { AssignmentSettings } from "@/server/assignment/types";

const AXES = [
  { key: "proximity", label: "Proximité / temps de trajet", help: "Poids du trajet réel depuis le rendez-vous précédent." },
  { key: "availability", label: "Confort des marges", help: "Pénalise les insertions qui tiennent à quelques minutes près." },
  { key: "workload", label: "Charge de travail", help: "Favorise l'opérateur qui a le moins de prestations ce jour." },
  { key: "revenueBalance", label: "Équilibre du CA", help: "Départage les candidats comparables par leur CA de la semaine." },
  { key: "quality", label: "Qualité / fiabilité", help: "Score qualité de l'opérateur (§25)." },
] as const;

const NUMBERS = [
  { key: "travelSafetyMarginMin", label: "Marge de sécurité entre RDV", unit: "min", help: "Ajoutée à chaque temps de trajet avant de juger un créneau faisable (§6)." },
  { key: "tightMarginMin", label: "Seuil « marge serrée »", unit: "min", help: "En dessous, le candidat est proposé mais signalé." },
  { key: "maxTravelMin", label: "Trajet maximum", unit: "min", help: "Au-delà, l'opérateur est écarté." },
  { key: "comparableBandMin", label: "Bande de comparabilité", unit: "min", help: "Au-delà de cet écart avec le meilleur trajet, charge et CA sont neutralisés (§39)." },
  { key: "targetJobsPerDay", label: "Objectif de prestations / jour", unit: "", help: "Base du taux de remplissage vert / orange / rouge (§5)." },
  { key: "candidatesReturned", label: "Candidats proposés", unit: "", help: "Nombre d'opérateurs affichés au conseiller (§4)." },
] as const;

const inputClass = `${FIELD_SURFACE} w-24 px-3 py-1.5 text-right tabular`;

export function SettingsForm({ settings }: { settings: AssignmentSettings }) {
  const [error, formAction, pending] = useActionState(saveSettings, null);
  const [weights, setWeights] = useState(() =>
    Object.fromEntries(
      AXES.map((axis) => [axis.key, Math.round(settings.weights[axis.key] * 100)]),
    ) as Record<(typeof AXES)[number]["key"], number>,
  );

  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl m-polished p-4">
        <h2 className="text-sm font-semibold text-ink-800">Pondération du score</h2>
        <p className="mt-1 text-xs text-ink-500">
          Saisie en pourcentages. La somme est renormalisée à l&apos;enregistrement : le score
          reste toujours sur 100.
        </p>

        <div className="mt-4 space-y-4">
          {AXES.map((axis) => (
            <div key={axis.key}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={axis.key} className="text-sm font-medium text-ink-700">
                  {axis.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={axis.key}
                    name={axis.key}
                    type="number"
                    min={0}
                    max={100}
                    value={weights[axis.key]}
                    onChange={(e) =>
                      setWeights((prev) => ({ ...prev, [axis.key]: Number(e.target.value) }))
                    }
                    className={inputClass}
                  />
                  <span className="text-sm text-ink-500">%</span>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{axis.help}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-xd-graphite">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${total > 0 ? (weights[axis.key] / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className={`mt-4 text-sm ${total === 100 ? "text-ink-500" : "text-xd-warn"}`}>
          Somme actuelle : <span className="tabular font-medium">{total} %</span>
          {total !== 100 && " — sera renormalisée à 100 %."}
        </p>
      </section>

      <section className="rounded-xl m-polished p-4">
        <h2 className="text-sm font-semibold text-ink-800">Contraintes de tournée</h2>

        <div className="mt-4 space-y-4">
          {NUMBERS.map((field) => (
            <div key={field.key}>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={field.key} className="text-sm font-medium text-ink-700">
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={field.key}
                    name={field.key}
                    type="number"
                    defaultValue={settings[field.key]}
                    className={inputClass}
                  />
                  <span className="w-6 text-sm text-ink-500">{field.unit}</span>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{field.help}</p>
            </div>
          ))}
        </div>

        {error && <p className="mt-4 rounded-lg bg-xd-danger/12 px-3 py-2 text-sm text-xd-danger">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
      </section>
    </form>
  );
}
