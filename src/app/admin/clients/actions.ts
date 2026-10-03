"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { notificationProvider } from "@/lib/providers/notifications";
import { recordAudit } from "@/server/audit";
import { formatEuros } from "@/server/pricing";
import { FOLLOW_UP_TEMPLATE } from "@/server/notification-templates";

/** §23 — relance d'un client qui n'a pas reloué depuis la période définie. */

const schema = z.object({ customerId: z.string().min(1) });

export type FollowUpResult = { ok: true } | { ok: false; error: string };

export async function sendFollowUp(input: { customerId: string }): Promise<FollowUpResult> {
  const user = await requireBackOffice();

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Client invalide" };

  const customer = await prisma.customer.findUnique({
    where: { id: parsed.data.customerId },
    include: {
      appointments: {
        where: { status: "COMPLETED" },
        orderBy: { scheduledStart: "desc" },
        take: 1,
        include: { service: { select: { name: true } } },
      },
    },
  });

  if (!customer) return { ok: false, error: "Client introuvable" };
  if (!customer.marketingOptIn) {
    return { ok: false, error: "Ce client n'a pas accepté d'être recontacté (§31)." };
  }

  const last = customer.appointments[0];
  const channel = customer.email ? "EMAIL" : "SMS";
  const recipient = customer.email ?? customer.phone;

  const payload = {
    prenom: customer.firstName ?? customer.companyName ?? "",
    dernierLavage: last?.scheduledStart.toISOString() ?? null,
    dernierePrestation: last?.service.name ?? null,
    dernierMontant: last ? formatEuros(last.totalCents) : null,
  };

  const result = await notificationProvider().send({
    channel,
    recipient,
    template: FOLLOW_UP_TEMPLATE,
    payload,
  });

  await prisma.notification.create({
    data: {
      channel,
      recipient,
      template: FOLLOW_UP_TEMPLATE,
      payload,
      status: result.sent ? "SENT" : "FAILED",
      providerRef: result.providerRef,
      error: result.error ?? null,
      sentAt: result.sent ? new Date() : null,
    },
  });

  await recordAudit({
    actorUserId: user.userId,
    actorLabel: user.name,
    action: "RELANCE_ENVOYEE",
    entityType: "Customer",
    entityId: customer.id,
    after: { channel, recipient, template: FOLLOW_UP_TEMPLATE },
  });

  revalidatePath("/admin/clients");
  return result.sent ? { ok: true } : { ok: false, error: result.error ?? "Envoi impossible" };
}
