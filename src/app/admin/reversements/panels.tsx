"use client";

import { useState, useTransition } from "react";
import { confirmPayout, emitSettlement } from "./actions";

export function EmitButton({
  operatorId,
  periodStart,
}: {
  operatorId: string;
  periodStart: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await emitSettlement({ operatorId, periodStart });
            if (!result.ok) setError(result.error);
          })
        }
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "…" : "Émettre"}
      </button>
      {error && <span className="max-w-48 text-right text-[11px] text-xd-danger">{error}</span>}
    </span>
  );
}

export function PayoutButton({ settlementId }: { settlementId: string }) {
  const [pending, start] = useTransition();
  const [reference, setReference] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-300 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"
      >
        Marquer viré
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <input
        id={`ref-${settlementId}`}
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder="Référence du virement"
        className="w-44 rounded-lg border border-ink-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
      />
      <span className="flex gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await confirmPayout({ settlementId, paymentRef: reference });
              if (!result.ok) setError(result.error);
              else setOpen(false);
            })
          }
          className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "…" : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-2 py-1.5 text-xs text-ink-500 hover:text-ink-800"
        >
          Annuler
        </button>
      </span>
      {error && <span className="text-[11px] text-xd-danger">{error}</span>}
    </span>
  );
}
