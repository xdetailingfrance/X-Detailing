/**
 * Score qualité par opérateur (§25).
 *
 * « Prise en compte des avis, ponctualité, réclamations, photos avant/après et
 * conformité du workflow. » Les cinq y sont, pondérés.
 *
 * Fonction pure : le score doit être explicable à l'opérateur ligne par ligne. Un
 * indicateur qui décide d'une part de son travail (§4, axe qualité) ne peut pas être
 * une boîte noire.
 */

export type QualityInput = {
  /** Note moyenne sur 5, `null` si aucun avis. */
  averageRating: number | null;
  reviewCount: number;
  /** Part des prestations démarrées à l'heure, 0 → 1. `null` si aucune donnée. */
  punctuality: number | null;
  /** Prestations terminées avec les huit photos attendues, sur le total terminé. */
  completedWithFullPhotos: number;
  completedCount: number;
  complaints: number;
  noShows: number;
};

export type QualityBreakdown = {
  score: number;
  axes: Array<{ key: string; label: string; weight: number; value: number | null; note: string }>;
};

const WEIGHTS = {
  reviews: 0.4,
  punctuality: 0.25,
  conformity: 0.2,
  complaints: 0.15,
} as const;

/** Score par défaut d'un opérateur sans historique : ni favorisé, ni pénalisé. */
export const NEUTRAL_SCORE = 80;

/** Un axe sans donnée ne pénalise pas : son poids est redistribué sur les autres. */
export function computeQualityScore(input: QualityInput): QualityBreakdown {
  const reviews = input.reviewCount > 0 && input.averageRating !== null
    ? Math.max(0, Math.min(1, (input.averageRating - 1) / 4))
    : null;

  const punctuality = input.punctuality;

  const conformity = input.completedCount > 0
    ? input.completedWithFullPhotos / input.completedCount
    : null;

  const incidents = input.complaints + input.noShows;
  const complaints = input.completedCount > 0
    ? Math.max(0, 1 - incidents / input.completedCount)
    : null;

  const axes = [
    { key: "reviews", label: "Avis clients", weight: WEIGHTS.reviews, value: reviews,
      note: input.reviewCount > 0 ? `${input.averageRating} ★ sur ${input.reviewCount} avis` : "aucun avis" },
    { key: "punctuality", label: "Ponctualité", weight: WEIGHTS.punctuality, value: punctuality,
      note: punctuality === null ? "aucune prestation démarrée" : `${Math.round(punctuality * 100)} % à l'heure` },
    { key: "conformity", label: "Conformité du workflow", weight: WEIGHTS.conformity, value: conformity,
      note: conformity === null ? "aucune prestation terminée"
        : `${input.completedWithFullPhotos}/${input.completedCount} avec toutes les photos` },
    { key: "complaints", label: "Incidents", weight: WEIGHTS.complaints, value: complaints,
      note: incidents === 0 ? "aucun incident" : `${incidents} incident${incidents > 1 ? "s" : ""}` },
  ];

  const measured = axes.filter((axis) => axis.value !== null);
  if (measured.length === 0) return { score: NEUTRAL_SCORE, axes };

  const totalWeight = measured.reduce((sum, axis) => sum + axis.weight, 0);
  const weighted = measured.reduce((sum, axis) => sum + axis.value! * axis.weight, 0);

  return { score: Math.round((weighted / totalWeight) * 100), axes };
}
