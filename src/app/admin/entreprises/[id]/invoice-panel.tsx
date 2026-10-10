"use client";

import { useState, useTransition } from "react";
import { createInvoice, settleInvoice } from "./actions";

/** §24 — préparation et émission de la facture mensuelle de flotte. */

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export type InvoicePreviewProps = {
  periodYear: number;
  periodMonth: number;
  lines: Array<{ appointmentId: string; label: string; amountCents: number }>;
  subtotalCents: number;
  vatRate: number;
  vatCents: number;
  totalCents: number;
  existingInvoiceId: string | null;
};

export function InvoicePanel({
  customerId,
  preview,
}: {
  customerId: string;
  preview: InvoicePreviewProps;
}) {
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const period = `${String(preview.periodMonth).padStart(2, "0")}/${preview.periodYear}`;

  return (
    <section className="rounded-xl m-polished">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-800">Facture de {period}</h2>
        <span className="text-xs text-ink-500">
          {preview.lines.length} prestation{preview.lines.length > 1 ? "s" : ""} à facturer
        </span>
      </header>

      {preview.lines.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-500">
          {preview.existingInvoiceId
            ? "Toutes les prestations de cette période sont déjà facturées."
            : "Aucune prestation terminée sur cette période."}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-ink-100">
            {preview.lines.map((line) => (
              <li key={line.appointmentId} className="flex items-baseline justify-between gap-4 px-4 py-2 text-sm">
                <span className="text-ink-700">{line.label}</span>
                <span className="tabular shrink-0 font-medium text-ink-900">
                  {euros(line.amountCents)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="divide-y divide-ink-100 border-t border-ink-200 bg-ink-50">
            {[
              ["Total HT", euros(preview.subtotalCents)],
              [`TVA ${(preview.vatRate * 100).toFixed(0)} %`, euros(preview.vatCents)],
              ["Total TTC", euros(preview.totalCents)],
            ].map(([label, value], index) => (
              <div key={label} className="flex items-baseline justify-between px-4 py-2">
                <dt className={`text-sm ${index === 2 ? "font-medium text-ink-800" : "text-ink-600"}`}>
                  {label}
                </dt>
                <dd className={`tabular ${index === 2 ? "text-base font-semibold text-ink-900" : "text-sm text-ink-700"}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-ink-100 px-4 py-3">
            {issued ? (
              <p className="text-sm font-medium text-xd-ok">
                Facture {issued} émise, payable à 30 jours.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending || preview.existingInvoiceId !== null}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const result = await createInvoice({
                        customerId,
                        year: preview.periodYear,
                        month: preview.periodMonth,
                      });
                      if (result.ok) setIssued(result.number ?? "émise");
                      else setError(result.error);
                    })
                  }
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? "Émission…" : `Émettre la facture de ${period}`}
                </button>
                <p className="mt-2 text-xs text-ink-500">
                  Le taux de TVA est figé sur la facture : un changement de réglage ne
                  réécrit jamais une facture émise.
                </p>
              </>
            )}

            {error && <p className="mt-2 text-sm text-xd-danger">{error}</p>}
          </div>
        </>
      )}
    </section>
  );
}

export function SettleInvoiceButton({
  invoiceId,
  customerId,
}: {
  invoiceId: string;
  customerId: string;
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
            const result = await settleInvoice({ invoiceId, customerId });
            if (!result.ok) setError(result.error);
          })
        }
        className="rounded-lg bg-black/[0.045] px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-300 disabled:opacity-60 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"
      >
        {pending ? "…" : "Marquer réglée"}
      </button>
      {error && <span className="text-[11px] text-xd-danger">{error}</span>}
    </span>
  );
}
