"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import { fortnightOf, issueSettlement, markSettlementPaid } from "@/server/settlements";

/** §38 point 5 — X Detailing encaisse et reverse à la quinzaine. Réservé au patron. */

export type SettlementActionResult =
  | { ok: true; reference?: string }
  | { ok: false; error: string };

const issueSchema = z.object({
  operatorId: z.string().min(1),
  periodStart: z.string().datetime(),
  adjustmentCents: z.coerce.number().int().min(-1_000_000).max(1_000_000).default(0),
  adjustmentNote: z.string().max(200).optional(),
});

export async function emitSettlement(
  input: z.input<typeof issueSchema>,
): Promise<SettlementActionResult> {
  const admin = await requireAdmin();

  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  const result = await issueSettlement({
    operatorId: parsed.data.operatorId,
    period: fortnightOf(new Date(parsed.data.periodStart)),
    adjustmentCents: parsed.data.adjustmentCents,
    adjustmentNote: parsed.data.adjustmentNote,
    actor: { userId: admin.userId, label: admin.name },
  });

  if (!result.ok) return result;

  revalidatePath("/admin/reversements");
  return { ok: true, reference: result.reference };
}

const paySchema = z.object({
  settlementId: z.string().min(1),
  paymentRef: z.string().max(80).optional(),
});

export async function confirmPayout(
  input: z.input<typeof paySchema>,
): Promise<SettlementActionResult> {
  const admin = await requireAdmin();

  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  const result = await markSettlementPaid({
    settlementId: parsed.data.settlementId,
    paymentRef: parsed.data.paymentRef,
    actor: { userId: admin.userId, label: admin.name },
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Échec" };

  revalidatePath("/admin/reversements");
  return { ok: true };
}
