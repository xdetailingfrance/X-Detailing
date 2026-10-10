"use client";

import type { ComponentProps, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-style";

/**
 * Boutons et champs (§11, §43).
 *
 * §11 — trois niveaux seulement. Le principal porte l'action, le secondaire l'alternative,
 * le tertiaire le recours. Aucune ombre lourde : un très léger relief et un effet de
 * pression suffisent à rendre un bouton physique.
 *
 * §43 — les champs sont des surfaces, pas des rectangles bordés. Le focus est violet,
 * la transition douce, et aucune bordure blanche permanente.
 */

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={`${buttonClass(variant, size)} ${className}`}
    >
      {children}
    </button>
  );
}

export const FIELD_SURFACE =
  "w-full bg-black/[0.03] px-3.5 py-2.5 text-body text-xd-text placeholder:text-xd-text-4 " +
  "[box-shadow:inset_0_0_0_1px_var(--xd-hairline)] rounded-[--radius-xd-sm] " +
  "outline-none transition-[box-shadow,background-color] duration-200 " +
  "focus:bg-black/[0.045] focus:[box-shadow:inset_0_0_0_1px_rgb(123_60_255/0.5),0_0_0_4px_rgb(123_60_255/0.14)]";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="mb-1.5 block text-meta text-xd-text-3">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 block text-meta text-xd-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-meta text-xd-text-4">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${FIELD_SURFACE} ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${FIELD_SURFACE} resize-y ${className}`} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={`${FIELD_SURFACE} appearance-none pr-9 ${className}`}>
      {children}
    </select>
  );
}

/**
 * Option sélectionnable — véhicule, prestation, créneau.
 *
 * §12 : la sélection ne se contente pas d'une bordure violette. La surface change de
 * matériau, gagne une lumière rasante, et avance très légèrement.
 */
export function Choice({
  selected,
  onSelect,
  children,
  className = "",
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`press w-full rounded-[--radius-xd-md] px-4 py-3.5 text-left transition-all duration-200 ${
        selected
          ? "m-purple -translate-y-px"
          : "bg-black/[0.03] [box-shadow:inset_0_0_0_1px_var(--xd-hairline)] hover:bg-black/[0.045]"
      } ${className}`}
    >
      {children}
    </button>
  );
}
