"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/server/time";
import { VEHICLE_ICON } from "@/components/vehicle-icons";

/**
 * Comparaison des deux formules (§17).
 *
 * Le prix affiché est celui qui sera facturé, jamais un « à partir de ».
 *
 * Le sélecteur de véhicule ne s'affiche que si le tarif en dépend. Tant qu'une
 * citadine et un utilitaire paient la même chose, demander au visiteur de choisir sa
 * catégorie pour lui montrer sept fois le même montant est une étape pour rien.
 */

export type PackPricing = {
  vehicleClass: string;
  priceCents: number;
  compareAtCents: number | null;
  durationMin: number;
};

export type Pack = {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  includes: string[];
  pricing: PackPricing[];
};

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function PackComparison({
  packs,
  vehicles,
}: {
  packs: Pack[];
  vehicles: Array<{ key: string; label: string }>;
}) {
  const [vehicleClass, setVehicleClass] = useState(vehicles[1]?.key ?? vehicles[0]?.key);

  // Le tarif dépend-il réellement du véhicule ?
  const variesByVehicle = packs.some(
    (pack) => new Set(pack.pricing.map((p) => p.priceCents)).size > 1,
  );

  return (
    <>
      {variesByVehicle && (
        <div className="mt-8 flex flex-wrap gap-2">
          {vehicles.map((vehicle) => {
            const selected = vehicle.key === vehicleClass;
            const Icon = VEHICLE_ICON[vehicle.key];
            return (
              <button
                key={vehicle.key}
                type="button"
                onClick={() => setVehicleClass(vehicle.key)}
                aria-pressed={selected}
                className={`press flex items-center gap-2 rounded-full py-2 pl-2.5 pr-4 text-meta font-medium transition-all duration-[--xd-micro] ${
                  selected
                    ? "bg-xd-violet text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)]"
                    : "bg-black/[0.04] text-xd-text-3 [box-shadow:inset_0_0_0_1px_rgb(12_12_17/0.1)] hover:text-xd-text-2"
                }`}
              >
                {Icon && <Icon className="w-7 shrink-0" />}
                {vehicle.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {packs.map((pack) => {
          const price = pack.pricing.find((p) => p.vehicleClass === vehicleClass);
          const signature = pack.tier === "SIGNATURE";

          return (
            <article
              key={pack.id}
              className={`flex flex-col rounded-[--radius-xd-xl] p-6 sm:p-7 ${
                signature ? "m-graphite edge-purple" : "m-polished"
              }`}
            >
              <p className="eyebrow text-xd-purple-bright">
                {signature ? "Intérieur et extérieur" : "Intérieur"}
              </p>

              <h3 className="font-display mt-2 text-h2 font-bold tracking-tight text-xd-text">
                {pack.name}
              </h3>

              {price ? (
                <p className="mt-4 flex items-baseline gap-3">
                  <span className="tabular text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-xd-text">
                    {euros(price.priceCents)}
                  </span>
                  {price.compareAtCents && (
                    <span className="tabular text-lg text-xd-text-4 line-through">
                      {euros(price.compareAtCents)}
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-4 text-body text-xd-text-3">Sur devis</p>
              )}

              {price && (
                <p className="mt-2 text-meta text-xd-text-3">
                  {formatDuration(price.durationMin)} sur place
                </p>
              )}

              {pack.description && (
                <p className="mt-4 text-body leading-relaxed text-xd-text-2">{pack.description}</p>
              )}

              <ul className="hairline-t mt-5 space-y-2.5 pt-5">
                {pack.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-meta text-xd-text-2">
                    <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-xd-purple-bright" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href={`/reserver?prestation=${pack.id}${variesByVehicle ? `&vehicule=${vehicleClass}` : ""}`}
                className={`press mt-7 inline-flex justify-center rounded-[--radius-xd-md] px-6 py-3.5 text-body font-semibold transition-colors duration-150 ${
                  signature
                    ? "bg-xd-purple text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.22)] hover:bg-xd-purple-bright"
                    : "bg-black/[0.045] text-xd-text [box-shadow:inset_0_0_0_1px_var(--xd-hairline)] hover:bg-black/[0.06]"
                }`}
              >
                Choisir {pack.name}
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
