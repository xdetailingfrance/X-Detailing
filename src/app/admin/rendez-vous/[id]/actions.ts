"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin, requireBackOffice } from "@/lib/auth/guard";
import { recordAudit } from "@/server/audit";
import { resolveAlerts } from "@/server/quality/alerts";
import { formatEuros } from "@/server/pricing";

/**
 * Régularisation par le central (§16, §27).
 *
 * Un écart de caisse bloque la clôture côté opérateur — c'est voulu. Mais il faut une
 * sortie, sinon le rendez-vous reste bloqué indéfiniment et la commission n'est jamais
 * calculée. Seul le patron peut trancher, et la décision est journalisée (§30).
 */

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const resolveSchema = z.object({
  appointmentId: z.string().min(1),
  /** `ACCEPT` : l'écart est assumé. `RECOVER` : le complément a été récupéré. */
  decision: z.enum(["ACCEPT", "RECOVER"]),
  note: z.string().max(300).optional(),
});

export async function settleCashDiscrepancy(
  input: z.input<typeof resolveSchema>,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();

  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  const { appointmentId, decision, note } = parsed.data;

  const payments = await prisma.payment.findMany({
    where: { appointmentId, discrepancyCents: { not: 0 } },
    select: { id: true, discrepancyCents: true, amountCents: true, receivedCents: true },
  });

  if (payments.length === 0) return { ok: false, error: "Aucun écart à régulariser." };

  const totalGap = payments.reduce((sum, p) => sum + p.discrepancyCents, 0);

  await prisma.$transaction(async (tx) => {
    for (const payment of payments) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          discrepancyCents: 0,
          // « Récupéré » : le montant reçu est aligné sur l'attendu. « Assumé » : on
          // conserve le montant réellement reçu, l'écart devient une perte constatée.
          ...(decision === "RECOVER" ? { receivedCents: payment.amountCents } : {}),
        },
      });
    }

    await tx.appointmentEvent.create({
      data: {
        appointmentId,
        type: "NOTE",
        userId: admin.userId,
        note:
          `Écart de caisse de ${formatEuros(totalGap)} régularisé — ` +
          `${decision === "RECOVER" ? "complément récupéré" : "écart assumé"}` +
          (note ? ` (${note})` : ""),
      },
    });
  });

  await resolveAlerts(appointmentId, ["CASH_MISMATCH"]);

  await recordAudit({
    actorUserId: admin.userId,
    actorLabel: admin.name,
    action: "ECART_CAISSE_REGULARISE",
    entityType: "Appointment",
    entityId: appointmentId,
    before: { discrepancyCents: totalGap },
    after: { decision, note: note ?? null },
  });

  revalidatePath(`/admin/rendez-vous/${appointmentId}`);
  revalidatePath("/admin");
  return { ok: true };
}

const alertSchema = z.object({ alertId: z.string().min(1) });

export async function acknowledgeAlert(
  input: z.input<typeof alertSchema>,
): Promise<AdminActionResult> {
  const user = await requireBackOffice();

  const parsed = alertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  await prisma.alert.update({
    where: { id: parsed.data.alertId },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: user.userId,
    },
  });

  revalidatePath("/admin");
  return { ok: true };
}
