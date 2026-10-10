"use client";

import { FIELD_SURFACE } from "@/components/controls";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkVoucherCode, confirmBooking, lookupNow, lookupSlots, type SlotLookup } from "./actions";
import { VEHICLES, type FunnelVehicleClass } from "./vehicles";
import { VEHICLE_ICON } from "@/components/vehicle-icons";
import { formatDuration } from "@/server/time";
import { PhotoStep } from "./photo-step";
import { initialStep } from "./funnel-step";

export type FunnelService = {
  /** Ce que la prestation comprend, une ligne par poste (§17). */
  includes: string[];
  /** Prestation mise en avant : un repère discret, pas un comparateur (§17). */
  featured: boolean;
  /** Niveau de gamme — il nomme le repère : le plus demandé, ou la finition haute. */
  tier: "ESSENTIAL" | "SIGNATURE" | string;
  id: string;
  name: string;
  kind: string;
  optionIds: string[];
  pricing: Record<string, { priceCents: number; durationMin: number }>;
};

export type FunnelOption = {
  id: string;
  name: string;
  category: string | null;
  priceCents: number;
  durationMin: number;
};

type VehicleClass = FunnelVehicleClass;

const STEPS = ["Véhicule", "Prestation", "Adresse", "Créneau", "Photos", "Coordonnées"] as const;

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const dayLabel = (iso: string) => {
  const date = new Date(`${iso}T12:00:00Z`);
  const today = new Date();
  const isToday = iso === today.toISOString().slice(0, 10);
  return {
    weekday: isToday
      ? "Auj."
      : date.toLocaleDateString("fr-FR", { weekday: "short", timeZone: "Europe/Paris" }),
    day: date.toLocaleDateString("fr-FR", { day: "numeric", timeZone: "Europe/Paris" }),
    month: date.toLocaleDateString("fr-FR", { month: "short", timeZone: "Europe/Paris" }),
  };
};

// Cibles tactiles généreuses : on remplit ce formulaire debout, au téléphone.
const field = `mt-1 ${FIELD_SURFACE} px-4 py-3.5 text-base`;

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-xd-text-2">{children}</span>;
}

export function BookingFunnel({
  services,
  options,
  days,
  depositRate,
  analysisAvailable,
  preset,
}: {
  services: FunnelService[];
  options: FunnelOption[];
  days: string[];
  /** §21 — le taux d'acompte est un réglage, pas une constante d'affichage. */
  depositRate: number;
  /** §19 — sans fournisseur de vision, l'étape photo reste utile mais n'analyse rien. */
  analysisAvailable: boolean;
  /**
   * Choix déjà faits sur la page d'accueil. « Choisir Concession Luxe » doit ouvrir
   * le tunnel avec la formule retenue, pas renvoyer à la première question.
   */
  preset?: { vehicleClass: VehicleClass | null; serviceId: string | null };

}) {
  const router = useRouter();

  const [step, setStep] = useState(() => initialStep(preset));
  const [vehicleClass, setVehicleClass] = useState<VehicleClass | null>(
    preset?.vehicleClass ?? null,
  );
  const [serviceId, setServiceId] = useState<string | null>(preset?.serviceId ?? null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [address, setAddress] = useState({ addressLine1: "", postalCode: "", city: "", accessNotes: "" });
  const [date, setDate] = useState(days[0]);
  const [immediate, setImmediate] = useState(false);
  const [lookup, setLookup] = useState<SlotLookup | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [contact, setContact] = useState({
    firstName: "", lastName: "", phone: "", email: "", make: "", model: "", marketingOptIn: false,
  });
  const [error, setError] = useState<string | null>(null);
  // Code de remise reçu par e-mail (§23). `applied` ne contient que ce que le serveur
  // a validé : on n'affiche jamais une remise que la confirmation refuserait.
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; discountCents: number; percentOff: number } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [checkingVoucher, startVoucherCheck] = useTransition();
  const [searching, startSearch] = useTransition();
  const [booking, startBooking] = useTransition();

  // Identifiant du devis en cours : il rattache l'analyse photo au rendez-vous créé (§19).
  const [quoteToken] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()),
  );

  const service = services.find((s) => s.id === serviceId) ?? null;
  const availableOptions = options.filter((o) => service?.optionIds.includes(o.id));

  /*
   * Onze options en liste plate se parcourent mal. Groupées, elles se lisent — et le
   * client repère d'un coup d'œil la famille qui le concerne. L'ordre des groupes suit
   * celui du catalogue : il est choisi, pas alphabétique.
   */
  const optionGroups = availableOptions.reduce<Array<[string | null, FunnelOption[]]>>(
    (groups, option) => {
      const last = groups[groups.length - 1];
      if (last && last[0] === (option.category ?? null)) last[1].push(option);
      else groups.push([option.category ?? null, [option]]);
      return groups;
    },
    [],
  );

  /*
   * Le déplacement n'est connu qu'une fois l'adresse géocodée et l'itinéraire calculé :
   * il arrive avec la réponse du serveur, pas avant. Tant qu'il manque, le panier
   * affiche la prestation seule — jamais un total qui augmenterait après coup sans
   * explication.
   */
  const travel = lookup?.ok ? { km: lookup.travelKm, cents: lookup.travelCents } : null;

  const price = (() => {
    if (!service || !vehicleClass) return null;
    const base = service.pricing[vehicleClass];
    if (!base) return null;
    const chosen = options.filter((o) => optionIds.includes(o.id));
    return {
      totalCents:
        base.priceCents +
        chosen.reduce((sum, o) => sum + o.priceCents, 0) +
        (travel?.cents ?? 0),
      durationMin: base.durationMin + chosen.reduce((sum, o) => sum + o.durationMin, 0),
      chosen,
      basePriceCents: base.priceCents,
    };
  })();

  const core = {
    vehicleClass: vehicleClass!,
    serviceId: serviceId!,
    optionIds,
    addressLine1: address.addressLine1,
    postalCode: address.postalCode,
    city: address.city,
    accessNotes: address.accessNotes,
  };

  function searchSlots(forDate: string) {
    setDate(forDate);
    setImmediate(false);
    setSlotStart(null);
    setError(null);
    startSearch(async () => {
      const result = await lookupSlots({ ...core, date: forDate });
      setLookup(result);
      if (!result.ok) setError(result.error);
    });
  }

  /** §7 — les opérateurs réellement capables d'arriver dans les prochaines heures. */
  function searchNow() {
    setImmediate(true);
    setSlotStart(null);
    setError(null);
    startSearch(async () => {
      const result = await lookupNow(core);
      setLookup(result);
      if (!result.ok) setError(result.error);
    });
  }

  function goToSlots() {
    setStep(3);
    searchSlots(date);
  }

  function submit() {
    if (!slotStart) return;
    setError(null);
    startBooking(async () => {
      const result = await confirmBooking({
        ...core,
        ...contact,
        start: slotStart,
        quoteToken,
        voucherCode: voucher?.code,
      });
      if (result.ok) {
        router.push(`/reservation/${result.token}`);
      } else {
        setError(result.error);
        if (result.slotTaken) {
          setStep(3);
          searchSlots(date);
        }
      }
    });
  }

  const canContinue = [
    vehicleClass !== null,
    serviceId !== null,
    address.addressLine1.length > 2 && /^\d{5}$/.test(address.postalCode) && address.city.length > 1,
    slotStart !== null,
    // L'étape photo est facultative : on peut la traverser sans rien envoyer.
    true,
    Boolean(
      contact.firstName && contact.lastName && contact.phone.length > 5 && contact.email.includes("@"),
    ),
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-24 sm:pt-28">
      {/*
        Progression discrète. Seule l'étape en cours est nommée : six libellés à
        11 px alignés sous six barres deviennent illisibles dès 375 px, et personne
        n'a besoin de relire les étapes déjà faites.
      */}
      <div className="mb-9">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-meta font-medium text-xd-violet-highlight">{STEPS[step]}</p>
          <p className="tabular text-meta text-xd-text-4">
            Étape {step + 1} sur {STEPS.length}
          </p>
        </div>
        <ol className="mt-2.5 flex gap-1" aria-label="Étapes de la réservation">
          {STEPS.map((name, index) => (
            <li key={name} className="flex-1">
              <span
                aria-current={index === step ? "step" : undefined}
                className={`block h-[3px] rounded-full transition-colors duration-[--xd-component] ${
                  index < step
                    ? "bg-xd-violet/60"
                    : index === step
                      ? "bg-xd-violet"
                      : "bg-black/[0.055]"
                }`}
              />
              <span className="sr-only">{name}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── 1. Véhicule ───────────────────────────────────────────────── */}
      {step === 0 && (
        <section>
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.3rem]">
            Quel est votre véhicule ?
          </h1>
          <p className="mt-1.5 text-sm text-xd-text-2">
            {/* Le prix ne dépend plus de la catégorie : le dire serait faux. Elle sert
                encore à l'opérateur, qui prépare son matériel en conséquence. */}
            Le tarif est le même pour toutes. L&apos;opérateur prépare son matériel en
            conséquence.
          </p>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {VEHICLES.map(([value, label, examples]) => {
              const Icon = VEHICLE_ICON[value];
              const selected = vehicleClass === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setVehicleClass(value);
                    setLookup(null);
                    setStep(1);
                  }}
                  className={`glass glass-interactive press flex items-center gap-4 rounded-[--radius-xd-lg] px-5 py-4 text-left ${
                    selected ? "glass-active" : ""
                  }`}
                >
                  {/* La silhouette précède le nom : on reconnaît sa voiture avant de
                      lire le mot qui la désigne. */}
                  <Icon
                    className={`w-14 shrink-0 transition-colors duration-[--xd-micro] ${
                      selected ? "text-xd-violet-highlight" : "text-xd-text-3"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block text-body font-semibold text-xd-text">{label}</span>
                    <span className="mt-0.5 block text-meta text-xd-text-3">{examples}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 2. Prestation ─────────────────────────────────────────────── */}
      {step === 1 && vehicleClass && (
        <section>
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.3rem]">
            Que faut-il laver ?
          </h1>
          <p className="mt-1.5 text-sm text-xd-text-2">
            Lavage intérieur, extérieur, ou les deux.
          </p>

          <div className="mt-6 space-y-2.5">
            {services.map((candidate) => {
              const base = candidate.pricing[vehicleClass];
              const selected = serviceId === candidate.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => {
                    setServiceId(candidate.id);
                    setOptionIds([]);
                    setLookup(null);
                  }}
                  className={`glass glass-interactive press block w-full rounded-[--radius-xd-lg] px-5 py-4 text-left ${
                    selected ? "glass-active" : ""
                  }`}
                >
                  {candidate.featured && (
                    <span className="eyebrow mb-2 block text-xd-purple-bright">
                      {candidate.tier === "SIGNATURE" ? "Finition signature" : "Le plus demandé"}
                    </span>
                  )}

                  <span className="flex items-baseline justify-between gap-4">
                    <span className="min-w-0">
                      <span className="font-display block text-base font-bold text-xd-text">
                        {candidate.name}
                      </span>
                      <span className="mt-0.5 block text-meta text-xd-text-3">
                        {base ? `${formatDuration(base.durationMin)} sur place` : "non disponible"}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-lg font-semibold text-xd-text">
                      {base ? euros(base.priceCents) : "—"}
                    </span>
                  </span>

                  {/*
                    §17 — le contenu du pack se lit avant de choisir, pas après. Il
                    n'apparaît que sur la prestation sélectionnée : quatre listes
                    ouvertes en même temps redeviennent un comparateur.
                  */}
                  {selected && candidate.includes.length > 0 && (
                    <span className="hairline-t mt-3 block pt-3">
                      {candidate.includes.map((item) => (
                        <span key={item} className="mt-1 flex gap-2 text-meta text-xd-text-2 first:mt-0">
                          <span aria-hidden className="text-xd-purple-bright">—</span>
                          {item}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {availableOptions.length > 0 && (
            <fieldset className="mt-7">
              <legend className="font-display text-base font-bold text-xd-text">
                Ajouter une option ?
              </legend>
              {optionGroups.map(([category, groupOptions]) => (
              <div key={category} className="mt-3 space-y-2">
                {category && (
                  <p className="eyebrow pt-2 text-xd-text-4">{category}</p>
                )}
                {groupOptions.map((option) => {
                  const checked = optionIds.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${
                        checked ? "glass glass-active" : "glass glass-interactive"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setOptionIds((prev) =>
                              checked ? prev.filter((id) => id !== option.id) : [...prev, option.id],
                            );
                            setLookup(null);
                          }}
                          className="size-4 rounded border-black/15 accent-xd-violet"
                        />
                        <span className="text-sm text-xd-text-2">{option.name}</span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-medium text-xd-text-2">
                        +{euros(option.priceCents)}
                      </span>
                    </label>
                  );
                })}
              </div>
              ))}
            </fieldset>
          )}
        </section>
      )}

      {/* ── 3. Adresse ────────────────────────────────────────────────── */}
      {step === 2 && (
        <section>
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.3rem]">
            Où intervenons-nous ?
          </h1>
          <p className="mt-1.5 text-sm text-xd-text-2">
            Chez vous, ou sur votre lieu de travail.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <Label>Rue et numéro</Label>
              <input
                id="addressLine1"
                className={field}
                value={address.addressLine1}
                onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })}
                placeholder="12 avenue de la Mairie"
                autoComplete="street-address"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <Label>Code postal</Label>
                <input
                  id="postalCode"
                  className={field}
                  value={address.postalCode}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                  placeholder="33370"
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </label>
              <label className="col-span-2 block">
                <Label>Ville</Label>
                <input
                  id="city"
                  className={field}
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  placeholder="Pompignac"
                  autoComplete="address-level2"
                />
              </label>
            </div>

            <label className="block">
              <Label>Accès (facultatif)</Label>
              <input
                id="accessNotes"
                className={field}
                value={address.accessNotes}
                onChange={(e) => setAddress({ ...address, accessNotes: e.target.value })}
                placeholder="Digicode, place de parking, point d'eau…"
              />
            </label>
          </div>
        </section>
      )}

      {/* ── 4. Créneau ────────────────────────────────────────────────── */}
      {step === 3 && (
        <section>
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.3rem]">
            Quand vous arrange-t-il ?
          </h1>
          <p className="mt-1.5 text-sm text-xd-text-2">
            Seuls les horaires qu&apos;un opérateur peut réellement tenir sont proposés.
          </p>

          <div className="-mx-5 mt-6 overflow-x-auto px-5">
            <div className="flex gap-2 pb-1">
              <button
                type="button"
                onClick={searchNow}
                className={`w-20 shrink-0 rounded-xl border px-2 py-2.5 text-center transition ${
                  immediate
                    ? "bg-xd-violet text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)]"
                    : "bg-black/[0.04] text-xd-text-2 [box-shadow:inset_0_0_0_1px_rgb(12_12_17/0.1)] hover:text-xd-text"
                }`}
              >
                <span className="block text-[11px] opacity-80">Au plus</span>
                <span className="block text-base font-semibold leading-tight">tôt</span>
                <span className="block text-[11px] opacity-80">aujourd&apos;hui</span>
              </button>

              {days.map((day) => {
                const { weekday, day: number, month } = dayLabel(day);
                const active = day === date;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => searchSlots(day)}
                    className={`w-16 shrink-0 rounded-xl border px-2 py-2.5 text-center transition ${
                      active && !immediate
                        ? "bg-xd-violet text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)]"
                        : "bg-black/[0.04] text-xd-text-2 [box-shadow:inset_0_0_0_1px_rgb(12_12_17/0.1)] hover:text-xd-text"
                    }`}
                  >
                    <span className="block text-[11px] capitalize opacity-80">{weekday}</span>
                    <span className="block text-lg font-semibold leading-tight">{number}</span>
                    <span className="block text-[11px] opacity-80">{month}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 min-h-32">
            {searching && (
              <p className="py-8 text-center text-sm text-xd-text-3">
                Analyse des tournées en cours…
              </p>
            )}

            {!searching && lookup?.ok && lookup.slots.length > 0 && (
              <>
                <p className="mb-3 text-xs text-xd-text-3">{lookup.formattedAddress}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {lookup.slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      onClick={() => setSlotStart(slot.start)}
                      className={`rounded-xl border py-3 text-center text-base font-semibold transition ${
                        slotStart === slot.start
                          ? "bg-xd-violet text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)]"
                          : "bg-black/[0.04] text-xd-text-2 [box-shadow:inset_0_0_0_1px_rgb(12_12_17/0.1)] hover:text-xd-text"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-xd-text-3">
                  Durée estimée sur place : {formatDuration(lookup.durationMin)}.
                  {immediate && " Ces créneaux sont tenus par un opérateur déjà en tournée près de chez vous."}
                </p>
              </>
            )}

            {!searching && lookup?.ok && lookup.slots.length === 0 && (
              <p className="rounded-xl border border-xd-warn/40 bg-xd-warn/10 px-4 py-3 text-sm text-xd-warn">
                Aucun créneau tenable ce jour-là à cette adresse. Essayez un autre jour —
                ou appelez-nous, nous trouverons une solution.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── 5. Photos (§19) ───────────────────────────────────────────── */}
      {step === 4 && (
        <PhotoStep
          serviceId={serviceId ?? ""}
          vehicleLabel={
            [contact.make, contact.model].filter(Boolean).join(" ") ||
            VEHICLES.find(([value]) => value === vehicleClass)?.[1] ||
            "Véhicule"
          }
          quoteToken={quoteToken}
          selectedOptionIds={optionIds}
          available={analysisAvailable}
          onAddOption={(optionId) =>
            setOptionIds((previous) =>
              previous.includes(optionId) ? previous : [...previous, optionId],
            )
          }
        />
      )}

      {/* ── 6. Coordonnées ────────────────────────────────────────────── */}
      {step === 5 && (
        <section>
          <h1 className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.3rem]">
            Vos coordonnées
          </h1>
          <p className="mt-1.5 text-sm text-xd-text-2">
            Pour vous envoyer la confirmation et vous prévenir quand l&apos;opérateur part.
          </p>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Label>Prénom</Label>
                <input
                  id="firstName"
                  className={field}
                  value={contact.firstName}
                  onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                  autoComplete="given-name"
                />
              </label>
              <label className="block">
                <Label>Nom</Label>
                <input
                  id="lastName"
                  className={field}
                  value={contact.lastName}
                  onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className="block">
              <Label>Téléphone</Label>
              <input
                id="phone"
                className={field}
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>

            <label className="block">
              <Label>E-mail</Label>
              <input
                id="email"
                className={field}
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                inputMode="email"
                autoComplete="email"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <Label>Marque (facultatif)</Label>
                <input
                  id="make"
                  className={field}
                  value={contact.make}
                  onChange={(e) => setContact({ ...contact, make: e.target.value })}
                />
              </label>
              <label className="block">
                <Label>Modèle (facultatif)</Label>
                <input
                  id="model"
                  className={field}
                  value={contact.model}
                  onChange={(e) => setContact({ ...contact, model: e.target.value })}
                />
              </label>
            </div>

            {/* Code de remise. Replié tant qu'on n'en a pas : un champ vide invite à
                chercher un code qu'on n'a pas, et fait hésiter avant de payer. */}
            <div className="hairline-t pt-4">
              {voucher ? (
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-xd-ok">
                    Code {voucher.code} appliqué — {voucher.percentOff} % de remise
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setVoucher(null);
                      setVoucherInput("");
                    }}
                    className="text-xs text-xd-text-3 underline underline-offset-4"
                  >
                    Retirer
                  </button>
                </p>
              ) : (
                <>
                  <Label>Code de remise (facultatif)</Label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="voucher"
                      className={`${field} mt-0 uppercase`}
                      value={voucherInput}
                      placeholder="XDAB12C"
                      autoCapitalize="characters"
                      onChange={(e) => {
                        setVoucherInput(e.target.value);
                        setVoucherError(null);
                      }}
                    />
                    <button
                      type="button"
                      disabled={checkingVoucher || voucherInput.trim().length < 4 || !serviceId || !vehicleClass}
                      onClick={() =>
                        startVoucherCheck(async () => {
                          const result = await checkVoucherCode({
                            code: voucherInput,
                            serviceId: serviceId!,
                            vehicleClass: vehicleClass!,
                            optionIds,
                            email: contact.email || undefined,
                          });
                          if (result.ok) {
                            setVoucher({
                              code: voucherInput.trim().toUpperCase(),
                              discountCents: result.discountCents,
                              percentOff: result.percentOff,
                            });
                            setVoucherError(null);
                          } else {
                            setVoucher(null);
                            setVoucherError(result.error);
                          }
                        })
                      }
                      className="press shrink-0 rounded-[--radius-xd-sm] bg-black/[0.045] px-4 text-meta font-medium text-xd-text-2 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)] disabled:opacity-50"
                    >
                      {checkingVoucher ? "…" : "Appliquer"}
                    </button>
                  </div>
                  {voucherError && <p className="mt-1.5 text-meta text-xd-danger">{voucherError}</p>}
                </>
              )}
            </div>

            <label className="flex items-start gap-3 text-sm text-xd-text-2">
              <input
                type="checkbox"
                checked={contact.marketingOptIn}
                onChange={(e) => setContact({ ...contact, marketingOptIn: e.target.checked })}
                className="mt-0.5 size-4 rounded border-black/15 accent-xd-violet"
              />
              Me proposer un nouveau lavage quand ce sera le moment.
            </label>
          </div>
        </section>
      )}

      {/* ── Récapitulatif permanent ───────────────────────────────────── */}
      {price && step > 0 && (
        <div className="glass mt-7 rounded-[--radius-xd-lg] px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-xd-text-2">
              {service?.name}
              {price.chosen.length > 0 && ` + ${price.chosen.length} option${price.chosen.length > 1 ? "s" : ""}`}
            </span>
            <span className="tabular text-lg font-bold text-xd-text">
              {euros(price.totalCents - (voucher?.discountCents ?? 0))}
            </span>
          </div>
          {travel && (
            <p className="tabular mt-0.5 text-xs text-xd-text-3">
              Déplacement {travel.km.toLocaleString("fr-FR")} km par la route ·{" "}
              {travel.cents === 0 ? "compris" : `+ ${euros(travel.cents)}`}
            </p>
          )}
          {voucher && (
            <p className="tabular mt-0.5 text-xs text-xd-ok">
              − {euros(voucher.discountCents)} avec le code {voucher.code}
            </p>
          )}
          <p className="tabular mt-0.5 text-xs text-xd-text-3">
            {formatDuration(price.durationMin)} sur place · acompte de{" "}
            {euros(Math.round((price.totalCents - (voucher?.discountCents ?? 0)) * depositRate))} à la réservation
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-xd-danger/40 bg-xd-danger/10 px-4 py-3 text-sm text-xd-danger" role="alert">
          {error}
        </p>
      )}

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <div className="mt-7 flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
            className="glass glass-interactive press rounded-full px-6 py-3.5 text-body font-medium text-xd-text-2"
          >
            Retour
          </button>
        )}

        {step < 5 && (
          <button
            type="button"
            disabled={!canContinue[step] || searching}
            onClick={() => {
              setError(null);
              if (step === 2) goToSlots();
              else setStep(step + 1);
            }}
            className="press flex-1 rounded-full bg-xd-violet px-6 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight disabled:bg-black/[0.045] disabled:text-xd-text-4 disabled:shadow-none"
          >
            {step === 2 ? "Voir les créneaux" : step === 4 ? "Passer à mes coordonnées" : "Continuer"}
          </button>
        )}

        {step === 5 && (
          <button
            type="button"
            disabled={!canContinue[5] || booking}
            onClick={submit}
            className="press flex-1 rounded-full bg-xd-violet px-6 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight disabled:bg-black/[0.045] disabled:text-xd-text-4 disabled:shadow-none"
          >
            {booking ? "Réservation…" : "Confirmer ma réservation"}
          </button>
        )}
      </div>
    </div>
  );
}
