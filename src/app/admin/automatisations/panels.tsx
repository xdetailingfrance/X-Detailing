"use client";

import { FIELD_SURFACE } from "@/components/controls";
import { useActionState, useState, useTransition } from "react";
import { saveLoyalty, triggerJob } from "./actions";
import type { LoyaltyRule } from "@/server/loyalty";

const inputClass = `mt-1 ${FIELD_SURFACE}`;

export function JobRunner({ name }: { name: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            const outcome = await triggerJob({ name });
            setResult(
              outcome.ok
                ? { ok: true, message: outcome.summary || "terminée" }
                : { ok: false, message: outcome.error },
            );
          })
        }
        className="rounded-lg bg-black/[0.045] px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300 disabled:opacity-60 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"
      >
        {pending ? "En cours…" : "Lancer"}
      </button>
      {result && (
        <span
          className={`max-w-56 text-right text-[11px] ${result.ok ? "text-xd-ok" : "text-xd-danger"}`}
        >
          {result.message}
        </span>
      )}
    </span>
  );
}

/**
 * Règle de fidélité (§37 phase 6).
 *
 * Le cahier des charges ne fixe pas la mécanique : c'est une décision commerciale. Le
 * système fournit donc un réglage, pas une offre figée.
 */
export function LoyaltyForm({ rule }: { rule: LoyaltyRule }) {
  const [error, formAction, pending] = useActionState(saveLoyalty, null);
  const [kind, setKind] = useState(rule.kind);

  return (
    <form action={formAction} className="rounded-xl m-polished">
      <header className="border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-800">Programme de fidélité</h2>
      </header>

      <div className="space-y-4 px-4 py-4">
        <label className="flex items-start gap-3 text-sm text-ink-700">
          <input
            id="enabled"
            name="enabled"
            type="checkbox"
            defaultChecked={rule.enabled}
            className="mt-0.5 size-4 rounded border-ink-300 accent-brand-600"
          />
          <span>
            Activer le programme
            <span className="mt-0.5 block text-xs text-ink-500">
              Désactivé, aucune nouvelle récompense n&apos;est attribuée. Celles déjà
              acquises restent utilisables.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-ink-600">Un avantage tous les</span>
            <input
              id="everyNWashes"
              name="everyNWashes"
              type="number"
              min={1}
              max={50}
              defaultValue={rule.everyNWashes}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-400">lavages terminés</span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-600">Nature de l&apos;avantage</span>
            <select
              id="kind"
              name="kind"
              defaultValue={rule.kind}
              onChange={(event) => setKind(event.target.value as LoyaltyRule["kind"])}
              className={inputClass}
            >
              <option value="DISCOUNT_PERCENT">Remise en pourcentage</option>
              <option value="FREE_SERVICE">Prestation offerte</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-600">
              {kind === "DISCOUNT_PERCENT" ? "Remise" : "Plafond offert"}
            </span>
            <input
              id="value"
              name="value"
              type="number"
              min={0}
              defaultValue={rule.value}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-400">
              {kind === "DISCOUNT_PERCENT"
                ? "en pourcentage du total"
                : "en centimes — évite d'offrir un lavage à 99 € acquis sur des lavages à 29 €"}
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-600">Validité</span>
            <input
              id="validityDays"
              name="validityDays"
              type="number"
              min={0}
              max={1095}
              defaultValue={rule.validityDays}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-ink-400">jours — 0 pour sans limite</span>
          </label>
        </div>

        {error && <p className="rounded-lg bg-xd-danger/12 px-3 py-2 text-sm text-xd-danger">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer la règle"}
        </button>
      </div>
    </form>
  );
}
