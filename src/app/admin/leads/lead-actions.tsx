"use client";

import Link from "next/link";
import { useTransition } from "react";
import { updateLeadStatus } from "./actions";

export function LeadActions({
  leadId,
  status,
  bookingHref,
}: {
  leadId: string;
  status: string;
  bookingHref: string;
}) {
  const [pending, start] = useTransition();

  const set = (next: "CONTACTED" | "LOST") =>
    start(async () => {
      await updateLeadStatus({ leadId, status: next });
    });

  if (status === "BOOKED") {
    return <span className="text-xs text-ink-400">—</span>;
  }

  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {status === "NEW" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => set("CONTACTED")}
          className="rounded-lg bg-black/[0.045] px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-300 disabled:opacity-60 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"
        >
          Appelé
        </button>
      )}
      {status !== "LOST" && (
        <Link
          href={bookingHref}
          className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          Créer le RDV
        </Link>
      )}
      {status !== "LOST" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => set("LOST")}
          className="rounded-lg px-2 py-1.5 text-xs text-ink-400 hover:text-ink-700 disabled:opacity-60"
        >
          Perdu
        </button>
      )}
    </span>
  );
}
