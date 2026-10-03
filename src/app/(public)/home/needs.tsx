"use client";

import { useState } from "react";
import Link from "next/link";
import { VEHICLES } from "../reserver/vehicles";
import { formatDuration } from "@/server/time";
import { VEHICLE_ICON } from "@/components/vehicle-icons";

/**
 * « De quoi votre voiture a-t-elle besoin ? » (§3, expérience 02).
 *
 * Le visiteur n'arrive pas avec le vocabulaire du métier : il arrive avec une voiture
 * dans un certain état et une échéance. On part donc de sa situation, et c'est le
 * système qui traduit en formule — l'inverse d'un catalogue où il faut déjà savoir ce
 * qu'on cherche pour trouver.
 *
 * Rien n'est recommandé qui ne soit tarifé : le prix affiché est celui de la grille,
 * pour la catégorie choisie, options comprises.
 */

export type NeedService = {
  id: string;
  code: string;
  name: string;
  tier: string;
  includes: string[];
  pricing: Record<string, { priceCents: number; durationMin: number } | undefined>;
};

export type NeedOption = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  durationMin: number;
};

/**
 * Les quatre situations réelles dans lesquelles on appelle un laveur.
 *
 * `serviceCode` et `optionCodes` pointent vers le catalogue : si une prestation change
 * de nom en base, la recommandation suit sans qu'on touche à ce fichier.
 */
const NEEDS = [
  {
    key: "propre",
    title: "Je veux juste qu'elle soit propre",
    detail: "Entretien courant. Poussière, traces, vitres, aspiration.",
    serviceCode: "PACK-CONCESSION",
    optionCodes: [] as string[],
  },
  {
    key: "sale",
    title: "Mon intérieur est vraiment sale",
    detail: "Taches sur les sièges, miettes, poils d'animaux, coffre chargé.",
    serviceCode: "PACK-CONCESSION",
    optionCodes: ["OPT-SIEGES", "OPT-POILS", "OPT-COFFRE"],
  },
  {
    key: "neuf",
    title: "Je veux la retrouver comme neuve",
    detail: "Intérieur repris à fond et carrosserie lavée à la main.",
    serviceCode: "PACK-LUXE",
    optionCodes: [],
  },
  {
    key: "restitution",
    title: "Je dois la rendre ou la revendre",
    detail: "Fin de leasing, reprise, annonce. Le véhicule doit se présenter.",
    serviceCode: "PACK-LUXE",
    optionCodes: ["OPT-PLASTIQUES"],
  },
] as const;

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function NeedsConfigurator({
  services,
  options,
}: {
  services: NeedService[];
  options: NeedOption[];
}) {
  const [needKey, setNeedKey] = useState<string | null>(null);
  const [vehicleClass, setVehicleClass] = useState<string | null>(null);

  const need = NEEDS.find((n) => n.key === needKey) ?? null;
  const service = need ? services.find((s) => s.code === need.serviceCode) : null;
  const chosenOptions = need
    ? options.filter((o) => (need.optionCodes as readonly string[]).includes(o.code))
    : [];

  const base = service && vehicleClass ? service.pricing[vehicleClass] : undefined;
  const totalCents = base
    ? base.priceCents + chosenOptions.reduce((sum, o) => sum + o.priceCents, 0)
    : 0;
  const totalMinutes = base
    ? base.durationMin + chosenOptions.reduce((sum, o) => sum + o.durationMin, 0)
    : 0;

  const vehicleLabel = VEHICLES.find(([key]) => key === vehicleClass)?.[1] ?? "";

  return (
    <section id="besoin" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:py-28">
      <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.6rem]">
        De quoi votre voiture a-t-elle besoin&nbsp;?
      </h2>
      <p className="mt-4 max-w-xl text-body text-xd-text-3">
        Quatre situations. Choisissez la vôtre, on vous dit quelle formule y répond et ce
        qu&apos;elle coûte pour votre véhicule.
      </p>

      {/* ── Les situations ──────────────────────────────────────────────── */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {NEEDS.map((candidate) => {
          const selected = candidate.key === needKey;
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setNeedKey(candidate.key);
                if (!vehicleClass) setVehicleClass("BERLINE");
              }}
              className={`glass glass-interactive press rounded-[--radius-xd-xl] p-6 text-left sm:p-7 ${
                selected ? "glass-active" : ""
              }`}
            >
              <p className="text-h3 font-semibold text-xd-text">{candidate.title}</p>
              <p className="mt-2 text-meta leading-relaxed text-xd-text-3">
                {candidate.detail}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── Le véhicule, puis la recommandation ─────────────────────────── */}
      {need && (
        <div className="rise mt-6">
          <div className="glass-premium overflow-hidden rounded-[--radius-xd-2xl]">
            <div className="px-6 py-6 sm:px-8 sm:py-7">
              <p className="eyebrow text-xd-text-4">Votre véhicule</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {VEHICLES.map(([key, label]) => {
                  const Icon = VEHICLE_ICON[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={key === vehicleClass}
                      onClick={() => setVehicleClass(key)}
                      className={`press flex items-center gap-2 rounded-full py-2 pl-2.5 pr-4 text-meta font-medium transition-all duration-[--xd-micro] ${
                        key === vehicleClass
                          ? "bg-xd-violet text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)]"
                          : "bg-white/[0.05] text-xd-text-3 [box-shadow:inset_0_0_0_1px_rgb(255_255_255/0.08)] hover:text-xd-text-2"
                      }`}
                    >
                      {Icon && <Icon className="w-7 shrink-0" />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {base && service ? (
              <div className="grid gap-px bg-white/[0.07] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="bg-xd-carbon px-6 py-7 sm:px-8">
                  <p className="eyebrow text-xd-violet-highlight">
                    Recommandé pour votre {vehicleLabel.toLowerCase()}
                  </p>
                  <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-xd-text">
                    {service.name}
                  </p>

                  <ul className="mt-5 space-y-2">
                    {service.includes.slice(0, 4).map((item) => (
                      <li key={item} className="flex gap-3 text-meta text-xd-text-2">
                        <span
                          aria-hidden
                          className="mt-[7px] size-1 shrink-0 rounded-full bg-xd-violet-highlight"
                        />
                        {item}
                      </li>
                    ))}
                    {chosenOptions.map((option) => (
                      <li key={option.id} className="flex gap-3 text-meta text-xd-violet-highlight">
                        <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-xd-violet-highlight" />
                        {option.name} · + {euros(option.priceCents)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col justify-between bg-xd-carbon px-6 py-7 sm:px-8">
                  <div>
                    <p className="tabular text-[2.5rem] font-semibold leading-none tracking-[-0.035em] text-xd-text">
                      {euros(totalCents)}
                    </p>
                    <p className="mt-2 text-meta text-xd-text-3">
                      {formatDuration(totalMinutes)} sur place · prix ferme
                    </p>
                  </div>

                  <Link
                    href={`/reserver?vehicule=${vehicleClass}&prestation=${service.id}${
                      chosenOptions.length > 0
                        ? `&options=${chosenOptions.map((o) => o.id).join(",")}`
                        : ""
                    }`}
                    className="press mt-6 inline-flex justify-center rounded-full bg-xd-violet px-6 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight"
                  >
                    Voir les créneaux
                  </Link>
                  <p className="mt-3 text-center text-micro text-xd-text-4">
                    Acompte à la réservation, solde le jour même
                  </p>
                </div>
              </div>
            ) : (
              <p className="border-t border-white/[0.07] px-6 py-6 text-meta text-xd-text-3 sm:px-8">
                Cette formule n&apos;est pas tarifée pour cette catégorie. Appelez-nous, on
                regarde ensemble.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
