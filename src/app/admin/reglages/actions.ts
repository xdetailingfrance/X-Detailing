"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { getAssignmentSettings, normalizeWeights, saveAssignmentSettings } from "@/server/settings";
import { recordAudit } from "@/server/audit";

/** §4 « exemple de score initial paramétrable » et §6 « marge de sécurité configurable ». */

const schema = z.object({
  proximity: z.coerce.number().min(0).max(100),
  availability: z.coerce.number().min(0).max(100),
  workload: z.coerce.number().min(0).max(100),
  revenueBalance: z.coerce.number().min(0).max(100),
  quality: z.coerce.number().min(0).max(100),
  travelSafetyMarginMin: z.coerce.number().int().min(0).max(60),
  tightMarginMin: z.coerce.number().int().min(0).max(120),
  maxTravelMin: z.coerce.number().int().min(5).max(180),
  comparableBandMin: z.coerce.number().int().min(0).max(60),
  targetJobsPerDay: z.coerce.number().int().min(1).max(12),
  candidatesReturned: z.coerce.number().int().min(1).max(10),
});

export async function saveSettings(_prev: string | null, formData: FormData): Promise<string | null> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Valeurs invalides";
  const values = parsed.data;

  const total = values.proximity + values.availability + values.workload + values.revenueBalance + values.quality;
  if (total === 0) return "La somme des poids ne peut pas être nulle.";

  const before = await getAssignmentSettings();
  const next = {
    // Les poids sont saisis en pourcentages et renormalisés : la somme fait toujours 1,
    // sinon le score ne serait plus sur 100.
    weights: normalizeWeights({
      proximity: values.proximity,
      availability: values.availability,
      workload: values.workload,
      revenueBalance: values.revenueBalance,
      quality: values.quality,
    }),
    travelSafetyMarginMin: values.travelSafetyMarginMin,
    tightMarginMin: values.tightMarginMin,
    maxTravelMin: values.maxTravelMin,
    comparableBandMin: values.comparableBandMin,
    targetJobsPerDay: values.targetJobsPerDay,
    candidatesReturned: values.candidatesReturned,
  };

  await saveAssignmentSettings(next, admin.userId);
  await recordAudit({
    actorUserId: admin.userId,
    actorLabel: admin.name,
    action: "REGLAGES_MOTEUR_MODIFIES",
    entityType: "Setting",
    entityId: "assignment",
    before,
    after: next,
  });

  revalidatePath("/admin/reglages");
  return null;
}
