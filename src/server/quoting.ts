import { prisma } from "./db";
import { getSetting, saveSetting } from "./settings";

/**
 * Règles commerciales du devis (§21).
 *
 * L'acompte était figé à 30 % dans deux fichiers. Le §21 en donne un autre : 159 € de
 * prestation, 15,90 € d'acompte — soit 10 %. Plutôt que de remplacer une constante par
 * une autre, le taux devient un réglage : c'est une décision commerciale, elle bougera.
 */

export type QuotingRule = {
  /** Part du total demandée à la réservation, 0 → 1. */
  depositRate: number;
  /** Acompte plancher : en dessous, les frais de transaction mangent le montant. */
  minimumDepositCents: number;
  /** Au-delà, on ne demande pas davantage même sur une grosse prestation. */
  maximumDepositCents: number;
};

export const DEFAULT_QUOTING: QuotingRule = {
  depositRate: 0.1,
  minimumDepositCents: 1000,
  maximumDepositCents: 5000,
};

export const QUOTING_KEY = "quoting";

export async function getQuotingRule(): Promise<QuotingRule> {
  const stored = await getSetting<Partial<QuotingRule>>(QUOTING_KEY);
  return { ...DEFAULT_QUOTING, ...(stored ?? {}) };
}

export async function saveQuotingRule(rule: QuotingRule, updatedByUserId: string | null) {
  await saveSetting(QUOTING_KEY, rule, updatedByUserId, "Acompte et règles de devis (§21)");
}

/** Arrondi au centime, borné par le plancher et le plafond. */
export function depositFor(totalCents: number, rule: QuotingRule): number {
  if (totalCents <= 0) return 0;
  const raw = Math.round(totalCents * rule.depositRate);
  return Math.min(totalCents, Math.max(rule.minimumDepositCents, Math.min(rule.maximumDepositCents, raw)));
}

export type QuoteBreakdown = {
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  depositRate: number;
};

export async function computeDeposit(totalCents: number): Promise<QuoteBreakdown> {
  const rule = await getQuotingRule();
  const depositCents = depositFor(totalCents, rule);
  return {
    totalCents,
    depositCents,
    balanceCents: totalCents - depositCents,
    depositRate: rule.depositRate,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §16 — DÉTECTION DE LA CATÉGORIE
// ═══════════════════════════════════════════════════════════════════════════

import type { VehicleClass } from "@/generated/prisma/enums";

export type VehicleDetection = {
  vehicleClass: VehicleClass;
  /** `true` quand le modèle a été reconnu ; sinon on a deviné sur la marque seule. */
  matched: boolean;
  label: string;
  make?: string;
  model?: string;
};

const CLASS_LABEL: Record<VehicleClass, string> = {
  CITADINE: "Citadine",
  BERLINE: "Berline",
  BREAK: "Break",
  SUV: "SUV",
  QUATRE_X_QUATRE: "4x4",
  UTILITAIRE: "Utilitaire",
  SEPT_PLACES: "7 places",
};

export function classLabel(vehicleClass: VehicleClass): string {
  return CLASS_LABEL[vehicleClass];
}

/** Normalise pour comparer « Série 3 », « serie 3 » et « SERIE-3 ». */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Déduit la catégorie à partir de la marque et du modèle.
 *
 * §16 : le résultat est présenté comme une **aide** — « SUV détecté », avec un bouton
 * « Modifier » — jamais comme une contrainte. Si rien ne correspond, on retombe sur la
 * berline, catégorie médiane, plutôt que de laisser le client devant un choix vide.
 */
export async function detectVehicleClass(
  make: string,
  model: string,
): Promise<VehicleDetection> {
  const normalizedMake = normalize(make);
  const normalizedModel = normalize(model);

  if (!normalizedMake) {
    return { vehicleClass: "BERLINE", matched: false, label: CLASS_LABEL.BERLINE };
  }

  const candidates = await prisma.vehicleModel.findMany({
    where: { make: { equals: make, mode: "insensitive" } },
    orderBy: { popularity: "desc" },
    select: { make: true, model: true, vehicleClass: true },
  });

  // Correspondance exacte, puis préfixe : « 308 SW » doit trouver « 308 ».
  const exact = candidates.find((c) => normalize(c.model) === normalizedModel);
  const partial =
    exact ??
    candidates.find(
      (c) =>
        normalizedModel.length >= 2 &&
        (normalizedModel.startsWith(normalize(c.model)) ||
          normalize(c.model).startsWith(normalizedModel)),
    );

  if (partial) {
    return {
      vehicleClass: partial.vehicleClass,
      matched: true,
      label: CLASS_LABEL[partial.vehicleClass],
      make: partial.make,
      model: partial.model,
    };
  }

  // Marque connue mais modèle inconnu : la catégorie la plus fréquente chez elle est
  // un meilleur pari que la valeur par défaut globale.
  if (candidates.length > 0) {
    const tally = new Map<VehicleClass, number>();
    for (const candidate of candidates) {
      tally.set(candidate.vehicleClass, (tally.get(candidate.vehicleClass) ?? 0) + 1);
    }
    const [dominant] = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    return {
      vehicleClass: dominant[0],
      matched: false,
      label: CLASS_LABEL[dominant[0]],
      make,
    };
  }

  return { vehicleClass: "BERLINE", matched: false, label: CLASS_LABEL.BERLINE, make };
}

/** Suggestions de modèles pour la saisie assistée. */
export async function suggestModels(make: string, query: string, take = 8) {
  return prisma.vehicleModel.findMany({
    where: {
      make: { equals: make, mode: "insensitive" },
      ...(query ? { model: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ popularity: "desc" }, { model: "asc" }],
    take,
    select: { make: true, model: true, vehicleClass: true },
  });
}

export async function listMakes(): Promise<string[]> {
  const rows = await prisma.vehicleModel.findMany({
    distinct: ["make"],
    orderBy: [{ popularity: "desc" }, { make: "asc" }],
    select: { make: true },
  });
  return rows.map((r) => r.make);
}
