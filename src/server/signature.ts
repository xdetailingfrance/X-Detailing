import { prisma } from "./db";
import { recordAudit } from "./audit";
import { getPaymentSummary } from "./payments";

/**
 * Signature du client à la prise en charge (§32).
 *
 * L'écran est « propre, presque institutionnel » : le client voit exactement ce qu'il
 * approuve — véhicule, plaque, prestation, options, total, acompte, solde — puis signe.
 *
 * Ce qui est signé est **figé** dans `acknowledged`. Si le devis évolue ensuite, la
 * signature ne couvre plus rien : c'est ce qui la rend opposable en cas d'impayé (§36).
 */

export type SignatureResult = { ok: true } | { ok: false; error: string };

/** Limite de taille du tracé : un paraphe normal fait quelques kilo-octets. */
const MAX_PATH_LENGTH = 100_000;

export async function recordSignature(input: {
  appointmentId: string;
  operatorId: string;
  paths: string;
  signerName: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<SignatureResult> {
  if (!input.paths.trim()) return { ok: false, error: "Signature vide." };
  if (input.paths.length > MAX_PATH_LENGTH) return { ok: false, error: "Signature trop lourde." };
  if (!input.signerName.trim()) return { ok: false, error: "Indiquez le nom du signataire." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true, reference: true, operatorId: true, status: true,
      vehicleClass: true, totalCents: true, discountCents: true, priceCents: true,
      optionsPriceCents: true, durationMin: true,
      service: { select: { name: true } },
      customer: { select: { firstName: true, lastName: true, companyName: true } },
      customerVehicle: { select: { make: true, model: true, plate: true } },
      options: { include: { option: { select: { name: true } } } },
      signature: { select: { id: true } },
    },
  });

  if (!appointment) return { ok: false, error: "Rendez-vous introuvable." };
  if (appointment.operatorId !== input.operatorId) {
    return { ok: false, error: "Ce rendez-vous n'est pas le vôtre." };
  }
  if (appointment.signature) return { ok: false, error: "Le client a déjà signé." };

  // On signe avant de commencer, une fois le véhicule contrôlé (§31).
  if (!["ARRIVED", "PHOTOS_BEFORE"].includes(appointment.status)) {
    return { ok: false, error: "La signature se recueille à la prise en charge." };
  }

  const summary = await getPaymentSummary(appointment.id);
  const vehicle = appointment.customerVehicle;

  const acknowledged = {
    reference: appointment.reference,
    client:
      appointment.customer.companyName ??
      `${appointment.customer.firstName ?? ""} ${appointment.customer.lastName ?? ""}`.trim(),
    vehicule: [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || appointment.vehicleClass,
    plaque: vehicle?.plate ?? null,
    prestation: appointment.service.name,
    options: appointment.options.map((o) => o.option.name),
    dureeMin: appointment.durationMin,
    totalCents: appointment.totalCents,
    remiseCents: appointment.discountCents,
    acompteRegleCents: summary.depositPaidCents,
    soldeCents: summary.balanceCents,
  };

  await prisma.signature.create({
    data: {
      appointmentId: appointment.id,
      paths: input.paths,
      signerName: input.signerName.trim(),
      acknowledged: acknowledged as never,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });

  await prisma.appointmentEvent.create({
    data: {
      appointmentId: appointment.id,
      type: "NOTE",
      operatorId: input.operatorId,
      note: `Bon de prise en charge signé par ${input.signerName.trim()}`,
    },
  });

  await recordAudit({
    actorUserId: null,
    actorLabel: `${input.signerName.trim()} (client)`,
    action: "BON_SIGNE",
    entityType: "Appointment",
    entityId: appointment.id,
    after: acknowledged,
  });

  return { ok: true };
}

export async function getSignature(appointmentId: string) {
  return prisma.signature.findUnique({ where: { appointmentId } });
}
