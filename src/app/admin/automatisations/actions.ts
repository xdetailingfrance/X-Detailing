"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { runJobByName } from "@/server/jobs";
import { saveLoyaltyRule } from "@/server/loyalty";
import { recordAudit } from "@/server/audit";

export type RunResult = { ok: true; summary: string } | { ok: false; error: string };

/** Lancement manuel d'une tâche, pour tester un réglage sans attendre l'ordonnanceur. */
export async function triggerJob(input: { name: string }): Promise<RunResult> {
  const admin = await requireAdmin();

  const outcome = await runJobByName(input.name, { force: true });
  revalidatePath("/admin/automatisations");

  if (outcome.status === "SUCCESS") {
    await recordAudit({
      actorUserId: admin.userId,
      actorLabel: admin.name,
      action: "TACHE_LANCEE",
      entityType: "JobRun",
      entityId: input.name,
      after: outcome.summary,
    });
    return {
      ok: true,
      summary: Object.entries(outcome.summary)
        .map(([key, value]) => `${key} : ${value}`)
        .join(" · "),
    };
  }

  return {
    ok: false,
    error: outcome.status === "FAILED" ? outcome.error : outcome.reason,
  };
}

const loyaltySchema = z.object({
  enabled: z.coerce.boolean(),
  everyNWashes: z.coerce.number().int().min(1).max(50),
  kind: z.enum(["DISCOUNT_PERCENT", "FREE_SERVICE"]),
  value: z.coerce.number().int().min(0).max(100_000),
  validityDays: z.coerce.number().int().min(0).max(1095),
});

export async function saveLoyalty(_prev: string | null, formData: FormData): Promise<string | null> {
  const admin = await requireAdmin();

  const parsed = loyaltySchema.safeParse({
    enabled: formData.get("enabled") === "on",
    everyNWashes: formData.get("everyNWashes"),
    kind: formData.get("kind"),
    value: formData.get("value"),
    validityDays: formData.get("validityDays"),
  });

  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Valeurs invalides";
  if (parsed.data.kind === "DISCOUNT_PERCENT" && parsed.data.value > 100) {
    return "Une remise ne peut pas dépasser 100 %.";
  }

  await saveLoyaltyRule(parsed.data, admin.userId);
  await recordAudit({
    actorUserId: admin.userId,
    actorLabel: admin.name,
    action: "FIDELITE_MODIFIEE",
    entityType: "Setting",
    entityId: "loyalty",
    after: parsed.data,
  });

  revalidatePath("/admin/automatisations");
  return null;
}
