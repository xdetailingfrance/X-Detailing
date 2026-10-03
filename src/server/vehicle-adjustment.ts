import { prisma } from "./db";
import { recordAudit } from "./audit";
import { computeDeposit, classLabel } from "./quoting";
import { formatEuros } from "./pricing";
import { raiseAlert } from "./quality/alerts";
import type { VehicleClass } from "@/generated/prisma/enums";

/**
 * Contrôle du véhicule à l'arrivée (§31).
 *
 * « Si modification : marque, modèle, catégorie, nouveau prix. La comparaison ancien /
 * nouveau doit être extrêmement lisible. »
 *
 * Le changement de catégorie change le prix. Il est donc proposé, puis **accepté par le
 * client** — la garde du §12 empêche de démarrer tant qu'il ne l'est pas. Sans cela,
 * le client découvrirait l'écart à la facture.
 */

export type AdjustmentProposal = {
  fromClass: VehicleClass;
  fromLabel: string;
  fromCents: number;
  toClass: VehicleClass;
  toLabel: string;
  toCents: number;
  deltaCents: number;
  newDurationMin: number;
  accepted: boolean;
};

export type AdjustmentResult =
  | { ok: true; proposal: AdjustmentProposal }
  | { ok: false; error: string };

export async function proposeAdjustment(input: {
  appointmentId: string;
  operatorId: string;
  toClass: VehicleClass;
  reason?: string | null;
  make?: string | null;
  model?: string | null;
}): Promise<AdjustmentResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true, reference: true, operatorId: true, status: true,
      vehicleClass: true, serviceId: true, totalCents: true, optionsPriceCents: true,
      discountCents: true, customerVehicleId: true,
      vehicleAdjustment: { select: { id: true } },
    },
  });

  if (!appointment) return { ok: false, error: "Rendez-vous introuvable." };
  if (appointment.operatorId !== input.operatorId) {
    return { ok: false, error: "Ce rendez-vous n'est pas le vôtre." };
  }
  if (appointment.status !== "ARRIVED") {
    return { ok: false, error: "Le contrôle du véhicule se fait à l'arrivée." };
  }
  if (appointment.vehicleAdjustment) {
    return { ok: false, error: "Un changement a déjà été proposé." };
  }
  if (appointment.vehicleClass === input.toClass) {
    return { ok: false, error: "C'est déjà la catégorie enregistrée." };
  }

  const pricing = await prisma.servicePricing.findUnique({
    where: {
      serviceId_vehicleClass: { serviceId: appointment.serviceId, vehicleClass: input.toClass },
    },
    select: { priceCents: true, durationMin: true },
  });

  if (!pricing) {
    return { ok: false, error: "Cette prestation n'est pas tarifée pour cette catégorie." };
  }

  const toCents = pricing.priceCents + appointment.optionsPriceCents - appointment.discountCents;

  await prisma.vehicleAdjustment.create({
    data: {
      appointmentId: appointment.id,
      fromClass: appointment.vehicleClass,
      toClass: input.toClass,
      fromCents: appointment.totalCents,
      toCents,
      reason: input.reason?.trim() || null,
      operatorId: input.operatorId,
    },
  });

  // La fiche véhicule du client est corrigée : la prochaine réservation partira juste.
  if (appointment.customerVehicleId && (input.make || input.model)) {
    await prisma.customerVehicle.update({
      where: { id: appointment.customerVehicleId },
      data: {
        vehicleClass: input.toClass,
        ...(input.make ? { make: input.make } : {}),
        ...(input.model ? { model: input.model } : {}),
      },
    });
  }

  await recordAudit({
    actorUserId: null,
    actorLabel: "Opérateur (contrôle véhicule)",
    action: "VEHICULE_RECLASSE",
    entityType: "Appointment",
    entityId: appointment.id,
    before: { classe: appointment.vehicleClass, totalCents: appointment.totalCents },
    after: { classe: input.toClass, totalCents: toCents, motif: input.reason ?? null },
  });

  return {
    ok: true,
    proposal: {
      fromClass: appointment.vehicleClass,
      fromLabel: classLabel(appointment.vehicleClass),
      fromCents: appointment.totalCents,
      toClass: input.toClass,
      toLabel: classLabel(input.toClass),
      toCents,
      deltaCents: toCents - appointment.totalCents,
      newDurationMin: pricing.durationMin,
      accepted: false,
    },
  };
}

/** Le client accepte le nouveau tarif : le rendez-vous est mis à jour. */
export async function acceptAdjustment(input: {
  appointmentId: string;
  operatorId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const adjustment = await prisma.vehicleAdjustment.findUnique({
    where: { appointmentId: input.appointmentId },
    include: {
      appointment: {
        select: { id: true, reference: true, operatorId: true, optionsPriceCents: true, discountCents: true, serviceId: true },
      },
    },
  });

  if (!adjustment) return { ok: false, error: "Aucun changement à valider." };
  if (adjustment.appointment.operatorId !== input.operatorId) {
    return { ok: false, error: "Ce rendez-vous n'est pas le vôtre." };
  }
  if (adjustment.acceptedAt) return { ok: false, error: "Déjà validé." };

  const pricing = await prisma.servicePricing.findUniqueOrThrow({
    where: {
      serviceId_vehicleClass: {
        serviceId: adjustment.appointment.serviceId,
        vehicleClass: adjustment.toClass,
      },
    },
    select: { priceCents: true, durationMin: true },
  });

  const { depositCents } = await computeDeposit(adjustment.toCents);

  await prisma.$transaction(async (tx) => {
    await tx.vehicleAdjustment.update({
      where: { id: adjustment.id },
      data: { acceptedAt: new Date() },
    });

    await tx.appointment.update({
      where: { id: adjustment.appointmentId },
      data: {
        vehicleClass: adjustment.toClass,
        priceCents: pricing.priceCents,
        totalCents: adjustment.toCents,
        durationMin: pricing.durationMin,
        // L'acompte déjà encaissé ne bouge pas ; c'est le solde qui absorbe l'écart.
        depositCents,
      },
    });

    await tx.appointmentEvent.create({
      data: {
        appointmentId: adjustment.appointmentId,
        type: "NOTE",
        operatorId: input.operatorId,
        note:
          `Véhicule reclassé ${classLabel(adjustment.fromClass)} → ${classLabel(adjustment.toClass)} · ` +
          `${formatEuros(adjustment.fromCents)} → ${formatEuros(adjustment.toCents)}, accepté par le client`,
      },
    });
  });

  // Un écart notable mérite d'être vu au central : c'est le signe d'une saisie
  // approximative à la réservation, ou d'un point à clarifier avec le client.
  if (Math.abs(adjustment.toCents - adjustment.fromCents) >= 2000) {
    await raiseAlert({
      type: "COMPLAINT",
      severity: "INFO",
      title: `Véhicule reclassé — ${adjustment.appointment.reference}`,
      message:
        `${classLabel(adjustment.fromClass)} → ${classLabel(adjustment.toClass)}, ` +
        `${formatEuros(adjustment.fromCents)} → ${formatEuros(adjustment.toCents)}.`,
      appointmentId: adjustment.appointmentId,
      operatorId: input.operatorId,
    });
  }

  return { ok: true };
}
