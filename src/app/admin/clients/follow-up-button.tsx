"use client";

import { useState, useTransition } from "react";
import { sendFollowUp } from "./actions";

export function FollowUpButton({ customerId }: { customerId: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (state === "sent") {
    return <span className="text-xs font-medium text-xd-ok">relance envoyée</span>;
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await sendFollowUp({ customerId });
            if (result.ok) setState("sent");
            else {
              setState("error");
              setMessage(result.error);
            }
          })
        }
        className="rounded-lg bg-black/[0.045] px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-300 disabled:opacity-60 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"
      >
        {pending ? "Envoi…" : "Relancer"}
      </button>
      {state === "error" && message && (
        <span className="max-w-48 text-right text-[11px] text-xd-danger">{message}</span>
      )}
    </span>
  );
}
