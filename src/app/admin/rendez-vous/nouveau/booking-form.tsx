"use client";

import { FIELD_SURFACE } from "@/components/controls";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createAppointment, searchOperators, type SearchResult } from "./actions";

export type ServiceDTO = {
  id: string;
  name: string;
  kind: string;
  optionIds: string[];
  pricing: Record<string, { priceCents: number; durationMin: number }>;
};

export type OptionDTO = {
  id: string;
  name: string;
  priceCents: number;
  durationMin: number;
};

const VEHICLE_CLASSES = [
  ["CITADINE", "Citadine"],
  ["BERLINE", "Berline"],
  ["BREAK", "Break"],
  ["SUV", "SUV"],
  ["QUATRE_X_QUATRE", "4x4"],
  ["UTILITAIRE", "Utilitaire"],
  ["SEPT_PLACES", "7 places"],
] as const;

type VehicleClassValue = (typeof VEHICLE_CLASSES)[number][0];

export type BookingDefaults = FormState & { optionIds: string[] };

type FormState = {
  firstName: string; lastName: string; phone: string; email: string;
  addressLine1: string; postalCode: string; city: string; accessNotes: string;
  vehicleClass: VehicleClassValue; make: string; model: string;
  serviceId: string; date: string; time: string; internalNotes: string;
};

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const clock = (value: Date | string) =>
  new Date(value).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });

const AXIS_LABEL: Record<string, string> = {
  proximity: "Proximité",
  availability: "Marges",
  workload: "Charge",
  revenueBalance: "Équilibre CA",
  quality: "Qualité",
};

const REJECTION_LABEL: Record<string, string> = {
  EXCLUDED: "Exclu",
  SUSPENDED: "Non actif",
  SERVICE_NOT_ALLOWED: "Prestation",
  OUTSIDE_HOURS: "Horaires",
  BREAK: "Pause",
  TIME_OFF: "Absence",
  OVERLAP: "Occupé",
  INBOUND_TRAVEL: "Trajet amont",
  OUTBOUND_TRAVEL: "Trajet aval",
  TOO_FAR: "Trop loin",
};

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

const inputClass = `mt-1 ${FIELD_SURFACE}`;

export function BookingForm({
  services,
  options,
  defaultDate,
  initial,
  leadId,
}: {
  services: ServiceDTO[];
  options: OptionDTO[];
  defaultDate: string;
  initial?: Partial<BookingDefaults>;
  leadId?: string | null;
}) {
  const [form, setForm] = useState<FormState>({
    firstName: "", lastName: "", phone: "", email: "",
    addressLine1: "", postalCode: "", city: "", accessNotes: "",
    vehicleClass: "BERLINE" as VehicleClassValue, make: "", model: "",
    serviceId: services.at(-1)?.id ?? "",
    internalNotes: "",
    ...initial,
    // La date et l'heure ne sont jamais reprises du modèle : c'est ce que le
    // conseiller a le client au téléphone pour décider.
    date: defaultDate,
    time: "10:00",
  });
  const [optionIds, setOptionIds] = useState<string[]>(initial?.optionIds ?? []);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; reference: string } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [creating, startCreate] = useTransition();

  const service = services.find((s) => s.id === form.serviceId);
  const availableOptions = options.filter((o) => service?.optionIds.includes(o.id));

  // §2 : le tarif et la durée se calculent en direct, avant même l'affectation.
  // Quelques additions sur une poignée d'options : mémoïser coûterait plus que calculer.
  const preview = (() => {
    const base = service?.pricing[form.vehicleClass];
    if (!base) return null;
    const chosen = options.filter((o) => optionIds.includes(o.id));
    return {
      priceCents: base.priceCents + chosen.reduce((sum, o) => sum + o.priceCents, 0),
      durationMin: base.durationMin + chosen.reduce((sum, o) => sum + o.durationMin, 0),
    };
  })();

  const set =
    (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }) as FormState);
      setResult(null);
      setSelected(null);
    };

  const payload = { ...form, optionIds, leadId: leadId ?? undefined };

  function onSearch() {
    setCreateError(null);
    startSearch(async () => {
      const response = await searchOperators(payload);
      setResult(response);
      setSelected(response.ok ? (response.candidates[0]?.operatorId ?? null) : null);
    });
  }

  function onConfirm() {
    if (!result?.ok || !selected) return;
    const candidate = result.candidates.find((c) => c.operatorId === selected);

    startCreate(async () => {
      const response = await createAppointment({
        ...payload,
        operatorId: selected,
        runId: result.runId,
        assignmentScore: candidate?.score ?? null,
        manualOverride: selected !== result.candidates[0]?.operatorId,
      });
      if (response.ok) setCreated({ id: response.id, reference: response.reference });
      else setCreateError(response.error);
    });
  }

  if (created) {
    return (
      <div className="rounded-xl border border-xd-ok/30 bg-xd-ok/12 p-6">
        <h2 className="text-lg font-semibold text-xd-ok">
          Rendez-vous {created.reference} créé
        </h2>
        <p className="mt-1 text-sm text-xd-ok">
          Il apparaît immédiatement dans l&apos;agenda de l&apos;opérateur et dans le planning central (§3).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/planning"
            className="rounded-lg bg-xd-ok px-4 py-2 text-sm font-medium text-white hover:bg-xd-ok"
          >
            Voir le planning
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setResult(null);
              setSelected(null);
              setForm((f) => ({ ...f, firstName: "", lastName: "", phone: "", email: "", addressLine1: "", postalCode: "", city: "", accessNotes: "", internalNotes: "" }));
              setOptionIds([]);
            }}
            className="rounded-lg border-xd-ok/30 bg-white/[0.06] px-4 py-2 text-sm font-medium text-xd-ok hover:bg-xd-ok/12 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]"
          >
            Nouveau rendez-vous
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── Saisie ──────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <section className="rounded-xl m-polished p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-800">Client</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom">
              <input className={inputClass} value={form.firstName} onChange={set("firstName")} />
            </Field>
            <Field label="Nom">
              <input className={inputClass} value={form.lastName} onChange={set("lastName")} />
            </Field>
            <Field label="Téléphone">
              <input className={inputClass} value={form.phone} onChange={set("phone")} inputMode="tel" />
            </Field>
            <Field label="E-mail">
              <input className={inputClass} value={form.email} onChange={set("email")} inputMode="email" />
            </Field>
          </div>
        </section>

        <section className="rounded-xl m-polished p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-800">Adresse d&apos;intervention</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Rue et numéro" className="col-span-3">
              <input className={inputClass} value={form.addressLine1} onChange={set("addressLine1")} placeholder="12 rue de la République" />
            </Field>
            <Field label="Code postal">
              <input className={inputClass} value={form.postalCode} onChange={set("postalCode")} inputMode="numeric" placeholder="69006" />
            </Field>
            <Field label="Ville" className="col-span-2">
              <input className={inputClass} value={form.city} onChange={set("city")} placeholder="Lyon" />
            </Field>
            <Field label="Accès (digicode, parking, point d'eau)" className="col-span-3">
              <input className={inputClass} value={form.accessNotes} onChange={set("accessNotes")} />
            </Field>
          </div>
        </section>

        <section className="rounded-xl m-polished p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-800">Véhicule et prestation</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type">
              <select className={inputClass} value={form.vehicleClass} onChange={set("vehicleClass")}>
                {VEHICLE_CLASSES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Marque">
              <input className={inputClass} value={form.make} onChange={set("make")} />
            </Field>
            <Field label="Modèle">
              <input className={inputClass} value={form.model} onChange={set("model")} />
            </Field>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {services.map((s) => (
              <label
                key={s.id}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                  form.serviceId === s.id
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink-200 text-ink-600 hover:border-ink-300"
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  className="sr-only"
                  checked={form.serviceId === s.id}
                  onChange={() => {
                    setForm((f) => ({ ...f, serviceId: s.id }));
                    setOptionIds([]);
                    setResult(null);
                  }}
                />
                <span className="font-medium">{s.name}</span>
                <span className="tabular mt-0.5 block text-xs opacity-70">
                  {s.pricing[form.vehicleClass]
                    ? `${euros(s.pricing[form.vehicleClass].priceCents)} · ${s.pricing[form.vehicleClass].durationMin} min`
                    : "tarif non défini"}
                </span>
              </label>
            ))}
          </div>

          {availableOptions.length > 0 && (
            <fieldset className="mt-3">
              <legend className="text-xs font-medium text-ink-600">Options</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {availableOptions.map((option) => {
                  const checked = optionIds.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
                        checked
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-ink-200 text-ink-600 hover:border-ink-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          setOptionIds((prev) =>
                            checked ? prev.filter((id) => id !== option.id) : [...prev, option.id],
                          );
                          setResult(null);
                        }}
                      />
                      {option.name} · +{euros(option.priceCents)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </section>

        <section className="rounded-xl m-polished p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-800">Créneau</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={set("date")} />
            </Field>
            <Field label="Heure de début">
              <input type="time" step={900} className={inputClass} value={form.time} onChange={set("time")} />
            </Field>
          </div>

          {preview && (
            <p className="tabular mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
              <strong className="font-semibold text-ink-900">{euros(preview.priceCents)}</strong>
              {" · "}
              {preview.durationMin} min
              <span className="ml-2 text-xs text-ink-500">
                fin prévue à{" "}
                {(() => {
                  const [h, m] = form.time.split(":").map(Number);
                  const total = h * 60 + m + preview.durationMin;
                  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                })()}
              </span>
            </p>
          )}

          <Field label="Note interne" className="mt-3">
            <textarea rows={2} className={inputClass} value={form.internalNotes} onChange={set("internalNotes")} />
          </Field>
        </section>

        <button
          type="button"
          onClick={onSearch}
          disabled={searching}
          className="w-full rounded-xl bg-ink-900 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-ink-800 disabled:opacity-60"
        >
          {searching ? "Analyse du réseau…" : "Trouver le meilleur opérateur"}
        </button>
      </div>

      {/* ── Propositions du moteur ──────────────────────────────────────── */}
      <div className="space-y-4">
        {/* §46 — pas de cadre en pointillés ni d'illustration : une surface calme
            et une phrase qui dit ce que la recherche va faire. */}
        {!result && (
          <div className="rounded-[--radius-xd-lg] px-6 py-10 text-center m-graphite">
            <p className="text-body font-medium text-xd-text-2">En attente d&apos;une recherche</p>
            <p className="mx-auto mt-2 max-w-sm text-meta text-xd-text-3">
              Le moteur analyse la disponibilité réelle, les horaires, la tournée du jour, le
              trajet depuis le rendez-vous précédent, la charge et le CA de chaque opérateur (§4).
            </p>
          </div>
        )}

        {result && !result.ok && (
          <p className="rounded-xl border border-xd-danger/30 bg-xd-danger/12 px-4 py-3 text-sm text-xd-danger">
            {result.error}
          </p>
        )}

        {result?.ok && (
          <>
            <div className="rounded-xl bg-white/[0.06] px-4 py-3 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink-800">
                  {result.candidates.length} opérateur{result.candidates.length > 1 ? "s" : ""} proposé
                  {result.candidates.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-ink-500">
                  calculé en {result.durationMs} ms
                  {!result.trafficAware && " · temps de trajet estimés, sans trafic réel"}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-500">{result.location.formatted}</p>
              <p className="tabular mt-1 text-xs text-ink-500">
                {result.quote.serviceName} · {euros(result.quote.totalCents)} ·{" "}
                {result.quote.totalDurationMin} min · début {clock(result.start)}
              </p>
            </div>

            {result.candidates.length === 0 && (
              <p className="rounded-xl border border-xd-warn/30 bg-xd-warn/12 px-4 py-3 text-sm text-xd-warn">
                Aucun opérateur ne peut prendre ce rendez-vous. Les motifs sont listés ci-dessous —
                proposez un autre créneau au client.
              </p>
            )}

            {result.candidates.map((candidate, rank) => {
              const isSelected = selected === candidate.operatorId;
              return (
                <label
                  key={candidate.operatorId}
                  className={`block cursor-pointer rounded-xl p-4 transition-all duration-200 ${
                    isSelected
                      ? "m-purple -translate-y-px"
                      : "bg-white/[0.035] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)] hover:bg-white/[0.06]"
                  }`}
                >
                  <input
                    type="radio"
                    name="operator"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => setSelected(candidate.operatorId)}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">
                        <span className="mr-2 text-ink-400">#{rank + 1}</span>
                        {candidate.operatorName}
                        <span className="ml-2 text-xs font-normal text-ink-400">{candidate.operatorCode}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">{candidate.originLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-2xl font-semibold text-ink-900">{candidate.score}</p>
                      <p className="text-[10px] uppercase tracking-wide text-ink-400">sur 100</p>
                    </div>
                  </div>

                  <div className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-600 sm:grid-cols-4">
                    <span>Trajet <strong className="font-semibold text-ink-900">{candidate.travelMin} min</strong></span>
                    <span>Distance <strong className="font-semibold text-ink-900">{candidate.distanceKm} km</strong></span>
                    <span>Départ <strong className="font-semibold text-ink-900">{clock(candidate.departAt)}</strong></span>
                    <span>RDV du jour <strong className="font-semibold text-ink-900">{candidate.jobsToday}</strong></span>
                    <span className="col-span-2">
                      CA semaine <strong className="font-semibold text-ink-900">{euros(candidate.revenueWeekCents)}</strong>
                    </span>
                    <span className="col-span-2 inline-flex items-center gap-1.5">
                      Remplissage
                      <span
                        className={`size-2 rounded-full ${
                          candidate.loadLevel === "LOW" ? "bg-xd-ok"
                          : candidate.loadLevel === "MEDIUM" ? "bg-xd-warn" : "bg-xd-danger"
                        }`}
                      />
                      <strong className="font-semibold text-ink-900">
                        {Math.round(candidate.fillRate * 100)} %
                      </strong>
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    {Object.entries(candidate.breakdown).map(([axis, detail]) => (
                      <div key={axis} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-[11px] text-ink-500">{AXIS_LABEL[axis] ?? axis}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-xd-graphite">
                          <span
                            className={`block h-full rounded-full ${detail.weight === 0 ? "bg-xd-steel" : "bg-brand-500"}`}
                            style={{ width: `${Math.round(detail.raw * 100)}%` }}
                          />
                        </span>
                        <span className="tabular w-12 shrink-0 text-right text-[11px] text-ink-400">
                          {Math.round(detail.weight * 100)} %
                        </span>
                      </div>
                    ))}
                  </div>

                  {candidate.flags.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {candidate.flags.map((flag) => (
                        <li key={flag} className="rounded-full bg-xd-warn/12 px-2 py-0.5 text-[11px] text-xd-warn">
                          {flag}
                        </li>
                      ))}
                    </ul>
                  )}

                  {!candidate.comparable && (
                    <p className="mt-2 text-[11px] text-ink-500">
                      Hors cohorte comparable : charge et équilibre du CA neutralisés pour ce candidat (§39).
                    </p>
                  )}
                </label>
              );
            })}

            {result.rejected.length > 0 && (
              <details className="rounded-xl m-polished">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-700">
                  {result.rejected.length} opérateur{result.rejected.length > 1 ? "s" : ""} écarté
                  {result.rejected.length > 1 ? "s" : ""}
                </summary>
                <ul className="divide-y divide-ink-100 border-t border-ink-100">
                  {result.rejected.map((rejection) => (
                    <li key={rejection.operatorId} className="flex items-baseline gap-3 px-4 py-2 text-sm">
                      <span className="w-40 shrink-0 font-medium text-ink-700">{rejection.operatorName}</span>
                      <span className="shrink-0 rounded bg-xd-graphite px-1.5 py-0.5 text-[11px] text-ink-600">
                        {REJECTION_LABEL[rejection.reason] ?? rejection.reason}
                      </span>
                      <span className="text-ink-500">{rejection.detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {createError && (
              <p className="rounded-xl border border-xd-danger/30 bg-xd-danger/12 px-4 py-3 text-sm text-xd-danger">
                {createError}
              </p>
            )}

            {result.candidates.length > 0 && (
              <div className="sticky bottom-4 rounded-xl m-polished p-3 shadow-lg">
                {selected !== result.candidates[0]?.operatorId && (
                  <p className="mb-2 text-xs text-xd-warn">
                    Choix manuel : il sera enregistré comme tel pour analyse ultérieure (§35).
                  </p>
                )}
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={creating || !selected}
                  className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {creating ? "Création…" : "Valider le rendez-vous"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
