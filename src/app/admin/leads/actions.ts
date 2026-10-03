"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { recordAudit } from "@/server/audit";

/** §19 — suivi d'un lead entre sa réception et le rendez-vous. */

const schema = z.object({
  leadId: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "BOOKED", "LOST"]),
  lostReason: z.string().max(200).optional(),
});

export async function updateLeadStatus(input: z.input<typeof schema>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireBackOffice();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide" };
  const { leadId, status, lostReason } = parsed.data;

  const before = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!before) return { ok: false, error: "Lead introuvable" };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      contactedAt: status === "CONTACTED" && !before.contactedAt ? new Date() : before.contactedAt,
      lostReason: status === "LOST" ? (lostReason ?? null) : null,
    },
  });

  await recordAudit({
    actorUserId: user.userId,
    actorLabel: user.name,
    action: "LEAD_STATUT_MODIFIE",
    entityType: "Lead",
    entityId: leadId,
    before: { status: before.status },
    after: { status },
  });

  revalidatePath("/admin/leads");
  return { ok: true };
}
