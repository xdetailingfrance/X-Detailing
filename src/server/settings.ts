import { prisma } from "./db";
import {
  DEFAULT_ASSIGNMENT_SETTINGS,
  type AssignmentSettings,
} from "./assignment/types";

/**
 * Réglages réseau (§4 « exemple de score initial paramétrable », §6 « marge de sécurité
 * configurable »).
 *
 * Modifier la pondération du moteur ne doit pas demander un redéploiement : les valeurs
 * vivent en base, avec repli sur les défauts si la clé n'existe pas encore.
 */

export const ASSIGNMENT_SETTINGS_KEY = "assignment";

export async function getAssignmentSettings(): Promise<AssignmentSettings> {
  const row = await prisma.setting.findUnique({ where: { key: ASSIGNMENT_SETTINGS_KEY } });
  if (!row) return DEFAULT_ASSIGNMENT_SETTINGS;

  const stored = row.value as Partial<AssignmentSettings>;
  return {
    ...DEFAULT_ASSIGNMENT_SETTINGS,
    ...stored,
    weights: { ...DEFAULT_ASSIGNMENT_SETTINGS.weights, ...(stored.weights ?? {}) },
  };
}

export async function saveAssignmentSettings(
  settings: AssignmentSettings,
  updatedByUserId: string | null,
): Promise<void> {
  await prisma.setting.upsert({
    where: { key: ASSIGNMENT_SETTINGS_KEY },
    create: {
      key: ASSIGNMENT_SETTINGS_KEY,
      value: settings,
      description: "Pondération et contraintes du moteur d'affectation (§4, §6, §39)",
      updatedByUserId,
    },
    update: { value: settings, updatedByUserId },
  });
}

// ─── Réglages génériques ─────────────────────────────────────────────────────

/** Lecture typée d'un réglage arbitraire. `null` si la clé n'existe pas encore. */
export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : null;
}

export async function saveSetting(
  key: string,
  value: unknown,
  updatedByUserId: string | null,
  description?: string,
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never, description, updatedByUserId },
    update: { value: value as never, updatedByUserId },
  });
}

/** Les poids doivent sommer à 1 : sinon le score n'est plus sur 100. */
export function normalizeWeights(
  weights: AssignmentSettings["weights"],
): AssignmentSettings["weights"] {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total <= 0) return DEFAULT_ASSIGNMENT_SETTINGS.weights;

  return Object.fromEntries(
    Object.entries(weights).map(([axis, w]) => [axis, w / total]),
  ) as AssignmentSettings["weights"];
}
