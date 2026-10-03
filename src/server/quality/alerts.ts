import { prisma } from "../db";
import type { AlertSeverity, AlertType } from "@/generated/prisma/enums";

/**
 * Alertes centralisées (§27).
 *
 * Une alerte n'est utile que si elle est vue. Le doublon est donc évité : rouvrir la
 * même alerte sur le même rendez-vous ne crée pas une seconde ligne, sinon le back-office
 * se remplit de bruit et le patron cesse de le regarder.
 */

export type RaiseAlertInput = {
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message: string;
  appointmentId?: string | null;
  operatorId?: string | null;
  customerId?: string | null;
};

export async function raiseAlert(input: RaiseAlertInput): Promise<void> {
  const existing = await prisma.alert.findFirst({
    where: {
      type: input.type,
      appointmentId: input.appointmentId ?? null,
      operatorId: input.operatorId ?? null,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.alert.update({
      where: { id: existing.id },
      data: { message: input.message, severity: input.severity ?? "WARNING" },
    });
    return;
  }

  await prisma.alert.create({
    data: {
      type: input.type,
      severity: input.severity ?? "WARNING",
      title: input.title,
      message: input.message,
      appointmentId: input.appointmentId ?? null,
      operatorId: input.operatorId ?? null,
      customerId: input.customerId ?? null,
    },
  });
}

/** Referme les alertes d'un rendez-vous dont la cause a disparu. */
export async function resolveAlerts(appointmentId: string, types: AlertType[]): Promise<void> {
  await prisma.alert.updateMany({
    where: { appointmentId, type: { in: types }, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}
