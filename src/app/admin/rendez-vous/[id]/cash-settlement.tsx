"use client";

import { useState, useTransition } from "react";
import { settleCashDiscrepancy } from "./actions";

/** §16 — la sortie du blocage, réservée au patron. */
export function CashSettlement({
  appointmentId,
  discrepancyCents,
}: {
  appointmentId: string;
  discrepancyCents: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const settle = (decision: "ACCEPT" | "RECOVER") =>
    start(async () => {
      setError(null);
      const result = await settleCashDiscrepancy({ appointmentId, decision, note });
      if (!result.ok) setError(result.error);
    });

  const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    discrepancyCents / 100,
  );

  return (
    <div className="border-t border-ink-100 px-4 py-3">
      <p className="text-sm font-medium text-xd-danger">
        Écart de caisse de {euros} — la clôture est bloquée.
      </p>
      <p className="mt-0.5 text-xs text-ink-500">
        L&apos;opérateur ne peut pas lever ce blocage lui-même. Tranchez, la décision est
        journalisée.
      </p>

      <input
        id="settlement-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note (facultatif)"
        className="mt-2 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => settle("RECOVER")}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Complément récupéré
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => settle("ACCEPT")}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
        >
          Écart assumé
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-xd-danger">{error}</p>}
    </div>
  );
}
