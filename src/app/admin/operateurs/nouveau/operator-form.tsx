"use client";

import { FIELD_SURFACE } from "@/components/controls";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOperator } from "./actions";

const WEEKDAYS = [
  [1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [0, "Dim"],
] as const;

const inputClass = `mt-1 ${FIELD_SURFACE}`;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

function Chip({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${
        checked ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-600 hover:border-ink-300"
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} />
      {children}
    </label>
  );
}

const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

export function OperatorForm({
  sectors,
  services,
}: {
  sectors: Array<{ id: string; code: string; name: string }>;
  services: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", password: "",
    homeAddress: "", homeSectorId: sectors[0]?.id ?? "",
    targetJobsPerDay: "5", commissionRate: "0.18",
    startTime: "08:00", endTime: "18:30",
    plate: "", activateNow: true,
  });
  const [coverage, setCoverage] = useState<string[]>(sectors[0] ? [sectors[0].id] : []);
  const [serviceIds, setServiceIds] = useState<string[]>(services.map((s) => s.id));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  function submit() {
    setError(null);
    start(async () => {
      const result = await createOperator({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        homeAddress: form.homeAddress,
        homeSectorId: form.homeSectorId,
        coverageSectorIds: coverage,
        serviceIds,
        targetJobsPerDay: form.targetJobsPerDay,
        commissionRate: form.commissionRate,
        startMinute: toMinutes(form.startTime),
        endMinute: toMinutes(form.endTime),
        weekdays,
        plate: form.plate,
        activateNow: form.activateNow,
      });

      if (result.ok) router.push(`/admin/operateurs/${result.id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl m-polished p-4">
        <h2 className="text-sm font-semibold text-ink-800">Identité et compte</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><input className={inputClass} value={form.firstName} onChange={set("firstName")} /></Field>
          <Field label="Nom"><input className={inputClass} value={form.lastName} onChange={set("lastName")} /></Field>
          <Field label="Téléphone"><input className={inputClass} value={form.phone} onChange={set("phone")} /></Field>
          <Field label="E-mail (identifiant)"><input className={inputClass} value={form.email} onChange={set("email")} /></Field>
          <Field label="Mot de passe provisoire" hint="À communiquer à l'opérateur, qui le changera.">
            <input type="text" className={inputClass} value={form.password} onChange={set("password")} />
          </Field>
          <Field label="Immatriculation Kangoo" hint="Facultatif (§29)">
            <input className={inputClass} value={form.plate} onChange={set("plate")} placeholder="GA-000-XD" />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-xl m-polished p-4">
        <h2 className="text-sm font-semibold text-ink-800">Zone d&apos;intervention</h2>
        <Field
          label="Adresse de départ"
          hint="Point de départ du premier trajet de la journée. Géocodée à l'enregistrement."
        >
          <input className={inputClass} value={form.homeAddress} onChange={set("homeAddress")} placeholder="18 rue Hénon, 69004 Lyon" />
        </Field>

        <Field label="Secteur de rattachement">
          <select className={inputClass} value={form.homeSectorId} onChange={set("homeSectorId")}>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="text-xs font-medium text-ink-600">Zones couvertes</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {sectors.map((s) => (
              <Chip key={s.id} checked={coverage.includes(s.id)} onToggle={() => toggle(coverage, s.id, setCoverage)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-ink-600">Prestations autorisées</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {services.map((s) => (
              <Chip key={s.id} checked={serviceIds.includes(s.id)} onToggle={() => toggle(serviceIds, s.id, setServiceIds)}>
                {s.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-3 rounded-xl m-polished p-4">
        <h2 className="text-sm font-semibold text-ink-800">Disponibilité</h2>
        <fieldset>
          <legend className="text-xs font-medium text-ink-600">Jours travaillés</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {WEEKDAYS.map(([value, label]) => (
              <Chip key={value} checked={weekdays.includes(value)} onToggle={() => toggle(weekdays, value, setWeekdays)}>
                {label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Début de journée"><input type="time" step={900} className={inputClass} value={form.startTime} onChange={set("startTime")} /></Field>
          <Field label="Fin de journée"><input type="time" step={900} className={inputClass} value={form.endTime} onChange={set("endTime")} /></Field>
        </div>
        <p className="text-xs text-ink-400">Pause déjeuner 12h30–13h30 par défaut, modifiable ensuite.</p>
      </section>

      <section className="space-y-3 rounded-xl m-polished p-4">
        <h2 className="text-sm font-semibold text-ink-800">Paramètres réseau</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objectif de prestations / jour" hint="Base du taux de remplissage (§5).">
            <input type="number" min={1} max={12} className={inputClass} value={form.targetJobsPerDay} onChange={set("targetJobsPerDay")} />
          </Field>
          <Field label="Taux de commission" hint="0.18 = 18 % (§18).">
            <input type="number" step="0.01" min={0} max={1} className={inputClass} value={form.commissionRate} onChange={set("commissionRate")} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={form.activateNow}
            onChange={(e) => setForm((prev) => ({ ...prev, activateNow: e.target.checked }))}
            className="size-4 rounded border-ink-300"
          />
          Activer immédiatement dans le moteur d&apos;affectation
        </label>

        {error && <p className="rounded-lg bg-xd-danger/12 px-3 py-2 text-sm text-xd-danger">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer l'opérateur"}
        </button>
      </section>
    </div>
  );
}
