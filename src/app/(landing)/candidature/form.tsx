"use client";

import { useActionState } from "react";
import { submitApplication, type ApplicationState } from "./actions";

/**
 * Formulaire de candidature (§9).
 *
 * Étiquettes toujours visibles — un libellé qui disparaît dès qu'on tape oblige à se
 * souvenir de ce qu'on remplit. Champs de 48 px, claviers adaptés, erreurs rattachées
 * au champ par `aria-describedby`.
 */

const STATUS = [
  ["SALARIE", "Salarié"],
  ["INDEPENDANT", "Indépendant"],
  ["DEMANDEUR_EMPLOI", "Demandeur d'emploi"],
  ["AUTRE", "Autre"],
] as const;

const EXPERIENCE = [
  ["AUCUNE", "Aucune expérience"],
  ["MOINS_2_ANS", "Moins de 2 ans"],
  ["PLUS_2_ANS", "Plus de 2 ans"],
  ["PROFESSIONNEL", "Je suis déjà professionnel du lavage"],
] as const;

const fieldClass =
  "mt-1.5 block h-12 w-full rounded-[14px] border border-[#2a2a36] bg-[#0f0f15] px-4 text-[16px] text-[color:var(--lp-text)] outline-none transition-colors placeholder:text-[#6a6d80] focus:border-[color:var(--lp-accent)]";

function Error({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-[13px] text-[#f0a3a3]">
      {message}
    </p>
  );
}

export function ApplicationForm() {
  const [state, action, pending] = useActionState<ApplicationState, FormData>(
    submitApplication,
    { status: "idle" },
  );

  if (state.status === "sent") {
    return (
      <div className="lp-card-hi rounded-[22px] p-7 text-center">
        <p className="lp-display text-[22px] font-semibold text-[color:var(--lp-title)]">
          Merci, nous revenons vers vous très vite.
        </p>
        <p className="mt-3 text-[16px] leading-[1.6] text-[color:var(--lp-body-hi)]">
          Votre candidature est enregistrée. Un membre de l&apos;équipe X Detailing vous
          rappelle sur le numéro que vous avez indiqué.
        </p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : {};
  const values = state.status === "error" ? state.values : {};

  return (
    <form action={action} noValidate className="space-y-5">
      {/* Piège à robots : invisible, jamais atteint au clavier. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-px w-px overflow-hidden">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-[14px] border border-[#5a2f3a] bg-[#2a1219] px-4 py-3 text-[14px] text-[#f0a3a3]">
          {state.message}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-[14px] font-medium text-[color:var(--lp-text)]">Prénom</span>
          <input
            name="firstName" defaultValue={values.firstName ?? ""} type="text" autoComplete="given-name" required
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? "err-firstName" : undefined}
            className={fieldClass}
          />
          <Error id="err-firstName" message={errors.firstName} />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-[color:var(--lp-text)]">Nom</span>
          <input
            name="lastName" defaultValue={values.lastName ?? ""} type="text" autoComplete="family-name" required
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? "err-lastName" : undefined}
            className={fieldClass}
          />
          <Error id="err-lastName" message={errors.lastName} />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-[color:var(--lp-text)]">Téléphone</span>
          <input
            name="phone" defaultValue={values.phone ?? ""} type="tel" inputMode="tel" autoComplete="tel" required
            placeholder="06 12 34 56 78"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "err-phone" : undefined}
            className={fieldClass}
          />
          <Error id="err-phone" message={errors.phone} />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-[color:var(--lp-text)]">E-mail</span>
          <input
            name="email" defaultValue={values.email ?? ""} type="email" inputMode="email" autoComplete="email" required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "err-email" : undefined}
            className={fieldClass}
          />
          <Error id="err-email" message={errors.email} />
        </label>
      </div>

      <label className="block">
        <span className="text-[14px] font-medium text-[color:var(--lp-text)]">
          Ville ou secteur visé
        </span>
        <input
          name="city" defaultValue={values.city ?? ""} type="text" autoComplete="address-level2" required
          placeholder="Là où vous souhaitez intervenir"
          aria-invalid={Boolean(errors.city)}
          aria-describedby={errors.city ? "err-city" : undefined}
          className={fieldClass}
        />
        <Error id="err-city" message={errors.city} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-[14px] font-medium text-[color:var(--lp-text)]">
            Situation actuelle
          </span>
          <select
            name="status" required defaultValue={values.status ?? ""}
            aria-invalid={Boolean(errors.status)}
            aria-describedby={errors.status ? "err-status" : undefined}
            className={`${fieldClass} appearance-none`}
          >
            <option value="" disabled>Choisir…</option>
            {STATUS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Error id="err-status" message={errors.status} />
        </label>

        <label className="block">
          <span className="text-[14px] font-medium text-[color:var(--lp-text)]">
            Expérience en lavage / detailing
          </span>
          <select
            name="experience" required defaultValue={values.experience ?? ""}
            aria-invalid={Boolean(errors.experience)}
            aria-describedby={errors.experience ? "err-experience" : undefined}
            className={`${fieldClass} appearance-none`}
          >
            <option value="" disabled>Choisir…</option>
            {EXPERIENCE.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Error id="err-experience" message={errors.experience} />
        </label>
      </div>

      <fieldset>
        <legend className="text-[14px] font-medium text-[color:var(--lp-text)]">
          Disposez-vous d&apos;un apport d&apos;au moins 3&nbsp;000&nbsp;€ ?
        </legend>
        <div className="mt-2.5 flex gap-3">
          {[["oui", "Oui"], ["non", "Non"]].map(([value, label]) => (
            <label
              key={value}
              className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-[#2a2a36] bg-[#0f0f15] text-[15px] text-[color:var(--lp-text)] has-[:checked]:border-[color:var(--lp-accent)] has-[:checked]:bg-[#1a1230]"
            >
              <input
                type="radio" name="hasFunding" value={value}
                defaultChecked={values.hasFunding === value}
                className="accent-[#8b5cf6]"
              />
              {label}
            </label>
          ))}
        </div>
        <Error id="err-hasFunding" message={errors.hasFunding} />
      </fieldset>

      <label className="block">
        <span className="text-[14px] font-medium text-[color:var(--lp-text)]">
          Message <span className="text-[color:var(--lp-note)]">(facultatif)</span>
        </span>
        <textarea
          name="message" rows={4} defaultValue={values.message ?? ""}
          placeholder="Votre projet, vos disponibilités, vos questions…"
          className={`${fieldClass} h-auto resize-y py-3`}
        />
      </label>

      <label className="flex cursor-pointer gap-3">
        <input
          type="checkbox" name="consent" required defaultChecked={values.consent === "on"}
          aria-describedby={errors.consent ? "err-consent" : undefined}
          className="mt-1 size-5 shrink-0 rounded accent-[#8b5cf6]"
        />
        <span className="text-[14px] leading-[1.6] text-[color:var(--lp-body)]">
          J&apos;accepte que X Detailing conserve ces informations pour étudier ma
          candidature et me recontacter.
        </span>
      </label>
      <Error id="err-consent" message={errors.consent} />

      <button
        type="submit"
        disabled={pending}
        className="lp-metal flex h-[58px] w-full items-center justify-center rounded-[16px] text-[15px] font-extrabold uppercase tracking-[0.1em] disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Envoyer ma candidature →"}
      </button>

      <p className="text-[12px] leading-[1.6] text-[color:var(--lp-note)]">
        Vos données servent uniquement à traiter votre candidature. Vous pouvez demander
        leur suppression à tout moment. Politique de confidentialité [À RÉDIGER].
      </p>
    </form>
  );
}
