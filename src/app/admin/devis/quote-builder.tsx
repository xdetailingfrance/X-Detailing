"use client";

import { useState } from "react";
import Link from "next/link";
import { Choice } from "@/components/controls";
import { buttonClass } from "@/components/button-style";
import { VEHICLES } from "@/app/(public)/reserver/vehicles";
import { formatDuration } from "@/server/time";

type Pricing = { priceCents: number; durationMin: number };

export type QuoteService = {
  id: string;
  name: string;
  optionIds: string[];
  pricing: Record<string, Pricing | undefined>;
};

export type QuoteOption = {
  id: string;
  name: string;
  priceCents: number;
  durationMin: number;
};

type QuotingRule = {
  depositRate: number;
  minimumDepositCents: number;
  maximumDepositCents: number;
};

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

/** Même règle qu'au serveur (§21) : plancher, plafond, arrondi. */
function depositFor(totalCents: number, rule: QuotingRule): number {
  if (totalCents <= 0) return 0;
  const raw = Math.round(totalCents * rule.depositRate);
  return Math.min(Math.max(raw, rule.minimumDepositCents), rule.maximumDepositCents);
}

export function QuoteBuilder({
  services,
  options,
  quoting,
}: {
  services: QuoteService[];
  options: QuoteOption[];
  quoting: QuotingRule;
}) {
  const [vehicleClass, setVehicleClass] = useState<string>("BERLINE");
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const base = service?.pricing[vehicleClass];
  const available = options.filter((o) => service?.optionIds.includes(o.id));

  // Additionner deux ou trois lignes ne mérite pas de mémoïsation : la recalculer à
  // chaque rendu coûte moins que le fil à retordre qu'elle donnerait à relire.
  const chosen = options.filter((o) => optionIds.includes(o.id));
  const totalCents =
    (base?.priceCents ?? 0) + chosen.reduce((sum, o) => sum + o.priceCents, 0);
  const depositCents = depositFor(totalCents, quoting);
  const quote = {
    chosen,
    totalCents,
    durationMin:
      (base?.durationMin ?? 0) + chosen.reduce((sum, o) => sum + o.durationMin, 0),
    depositCents,
    balanceCents: totalCents - depositCents,
  };

  const vehicleLabel = VEHICLES.find(([key]) => key === vehicleClass)?.[1] ?? vehicleClass;

  /** Le texte que le conseiller lit au téléphone, ou colle dans un SMS. */
  const spoken = base
    ? [
        `${service?.name} — ${vehicleLabel}`,
        ...quote.chosen.map((o) => `+ ${o.name} (${euros(o.priceCents)})`),
        `Total : ${euros(quote.totalCents)}`,
        `Durée sur place : ${formatDuration(quote.durationMin)}`,
        `Acompte à la réservation : ${euros(quote.depositCents)}`,
        `Solde le jour même : ${euros(quote.balanceCents)}`,
      ].join("\n")
    : "";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section>
          <h2 className="eyebrow text-xd-text-4">Catégorie du véhicule</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {VEHICLES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setVehicleClass(key)}
                aria-pressed={key === vehicleClass}
                className={`press rounded-[--radius-xd-sm] px-4 py-2 text-meta font-medium transition-all duration-150 ${
                  key === vehicleClass
                    ? "m-purple text-xd-text"
                    : "bg-white/[0.04] text-xd-text-3 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)] hover:text-xd-text-2"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="eyebrow text-xd-text-4">Prestation</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {services.map((candidate) => {
              const price = candidate.pricing[vehicleClass];
              return (
                <Choice
                  key={candidate.id}
                  selected={candidate.id === serviceId}
                  onSelect={() => {
                    setServiceId(candidate.id);
                    setOptionIds([]);
                  }}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-xd-text">{candidate.name}</span>
                    <span className="tabular text-xd-text-2">
                      {price ? euros(price.priceCents) : "—"}
                    </span>
                  </span>
                  {price && (
                    <span className="mt-0.5 block text-meta text-xd-text-3">
                      {formatDuration(price.durationMin)} sur place
                    </span>
                  )}
                </Choice>
              );
            })}
          </div>
        </section>

        {available.length > 0 && (
          <section>
            <h2 className="eyebrow text-xd-text-4">Options</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {available.map((option) => (
                <Choice
                  key={option.id}
                  selected={optionIds.includes(option.id)}
                  onSelect={() =>
                    setOptionIds((previous) =>
                      previous.includes(option.id)
                        ? previous.filter((id) => id !== option.id)
                        : [...previous, option.id],
                    )
                  }
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-xd-text">{option.name}</span>
                    <span className="tabular text-xd-text-2">+ {euros(option.priceCents)}</span>
                  </span>
                  <span className="mt-0.5 block text-meta text-xd-text-3">
                    + {option.durationMin} min
                  </span>
                </Choice>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Le devis suit le défilement : le conseiller ne doit jamais chercher le montant. */}
      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-[--radius-xd-lg] p-6 m-graphite">
          <p className="eyebrow text-xd-text-4">Devis</p>

          {base ? (
            <>
              <p className="tabular mt-2 text-[2.75rem] font-semibold leading-none tracking-[-0.035em] text-xd-text">
                {euros(quote.totalCents)}
              </p>
              <p className="mt-2 text-meta text-xd-text-3">
                {service?.name} · {vehicleLabel} · {formatDuration(quote.durationMin)} sur place
              </p>

              <dl className="hairline-t mt-5 space-y-2 pt-5 text-meta">
                <div className="flex justify-between gap-4">
                  <dt className="text-xd-text-3">Prestation</dt>
                  <dd className="tabular text-xd-text-2">{euros(base.priceCents)}</dd>
                </div>
                {quote.chosen.map((option) => (
                  <div key={option.id} className="flex justify-between gap-4">
                    <dt className="text-xd-text-3">{option.name}</dt>
                    <dd className="tabular text-xd-text-2">+ {euros(option.priceCents)}</dd>
                  </div>
                ))}
                <div className="hairline-t flex justify-between gap-4 pt-2">
                  <dt className="text-xd-text-3">Acompte à la réservation</dt>
                  <dd className="tabular text-xd-purple-bright">{euros(quote.depositCents)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-xd-text-3">Solde le jour même</dt>
                  <dd className="tabular text-xd-text-2">{euros(quote.balanceCents)}</dd>
                </div>
              </dl>

              <div className="mt-6 space-y-2">
                <Link
                  href={`/admin/rendez-vous/nouveau?vehicule=${vehicleClass}&prestation=${serviceId}${
                    optionIds.length > 0 ? `&options=${optionIds.join(",")}` : ""
                  }`}
                  className={`${buttonClass("primary", "lg")} w-full`}
                >
                  Transformer en rendez-vous
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(spoken).then(
                      () => setCopied(true),
                      () => setCopied(false),
                    );
                  }}
                  className={`${buttonClass("secondary")} w-full`}
                >
                  {copied ? "Devis copié" : "Copier le devis"}
                </button>
              </div>

              <p className="mt-4 text-micro leading-relaxed text-xd-text-4">
                Prix ferme pour cette catégorie. Si l&apos;opérateur constate un autre
                véhicule sur place, le tarif est recalculé et le client doit l&apos;accepter
                avant le démarrage (§31).
              </p>
            </>
          ) : (
            <p className="mt-2 text-body text-xd-text-3">
              Cette prestation n&apos;est pas tarifée pour un {vehicleLabel.toLowerCase()}.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
