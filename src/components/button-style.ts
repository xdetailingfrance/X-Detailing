/**
 * Vocabulaire des boutons (§11).
 *
 * Isolé du composant pour qu'un `Link` puisse porter exactement la même apparence :
 * un « Nouvel opérateur » qui navigue et un « Enregistrer » qui soumet doivent se
 * ressembler au pixel près, sans que l'un recopie les classes de l'autre.
 */

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "md" | "lg";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Violet profond maîtrisé, relief par la lumière du haut plutôt que par une ombre.
  primary:
    "bg-xd-purple text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.22)] hover:bg-xd-purple-bright disabled:bg-white/[0.06] disabled:text-xd-text-4 disabled:shadow-none",
  secondary:
    "bg-white/[0.06] text-xd-text-2 [box-shadow:inset_0_0_0_1px_var(--xd-hairline)] hover:bg-white/[0.09] hover:text-xd-text disabled:text-xd-text-4",
  tertiary: "text-xd-text-3 hover:text-xd-text disabled:text-xd-text-4",
  danger:
    "bg-xd-danger/12 text-xd-danger [box-shadow:inset_0_0_0_1px_rgb(229_106_106/0.24)] hover:bg-xd-danger/18",
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-meta rounded-[--radius-xd-sm]",
  lg: "px-6 py-3.5 text-body rounded-[--radius-xd-md]",
};

export const BUTTON_BASE =
  "press inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:cursor-not-allowed";

/**
 * Le tertiaire n'a pas de fond : lui laisser le rembourrage horizontal d'un bouton
 * le désaligne du texte au-dessus. Il se comporte comme un lien, pas comme une touche.
 */
const TERTIARY_SIZES: Record<ButtonSize, string> = {
  md: "py-1.5 text-meta",
  lg: "py-2.5 text-body",
};

/** Classes d'un bouton, pour un élément qui n'en est pas un — typiquement un `Link`. */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md"): string {
  const sizing = variant === "tertiary" ? TERTIARY_SIZES[size] : BUTTON_SIZES[size];
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${sizing}`;
}
