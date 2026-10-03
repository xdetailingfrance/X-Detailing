"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireBackOffice } from "@/lib/auth/guard";
import { geocode } from "@/server/geocoding";
import { quote, PricingError } from "@/server/pricing";
import { runAssignment } from "@/server/assignment/service";
import { recordAudit } from "@/server/audit";
import { getAvailableReward, rewardDiscountCents } from "@/server/loyalty";
import { computeDeposit } from "@/server/quoting";
import { fromLocalDateTimeInput } from "@/server/time";
import type { Candidate, Rejection } from "@/server/assignment/types";

/**
 * §3 — prise de rendez-vous par X Detailing, et §35 — « TROUVER LE MEILLEUR OPÉRATEUR ».
 *
 * Le conseiller saisit le client au téléphone, le moteur propose, le patron valide.
 */

const searchSchema = z.object({
  leadId: z.string().optional(),
  addressLine1: z.string().min(3, "Adresse trop courte"),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide"),
  city: z.string().min(2, "Ville manquante"),
  vehicleClass: z.enum([
    "CITADINE", "BERLINE", "BREAK", "SUV", "QUATRE_X_QUATRE", "UTILITAIRE", "SEPT_PLACES",
  ]),
  serviceId: z.string().min(1, "Prestation manquante"),
  optionIds: z.array(z.string()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide"),
});

export type SearchInput = z.input<typeof searchSchema>;

export type SearchResult =
  | { ok: false; error: string }
  | {
      ok: true;
      runId: string;
      candidates: Candidate[];
      rejected: Rejection[];
      quote: { serviceName: string; totalCents: number; totalDurationMin: number };
      location: { lat: number; lng: number; formatted: string; accuracy: string };
      start: string;
      trafficAware: boolean;
      durationMs: number;
    };

export async function searchOperators(input: SearchInput): Promise<SearchResult> {
  const user = await requireBackOffice();

  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }
  const data = parsed.data;

  const fullAddress = `${data.addressLine1}, ${data.postalCode} ${data.city}`;
  const location = await geocode(fullAddress);
  if (!location) {
    return {
      ok: false,
      error: `Adresse introuvable : « ${fullAddress} ». Vérifiez la saisie — sans coordonnées, le moteur ne peut pas calculer les trajets.`,
    };
  }

  let pricing;
  try {
    pricing = await quote({
      serviceId: data.serviceId,
      vehicleClass: data.vehicleClass,
      optionIds: data.optionIds,
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  const start = fromLocalDateTimeInput(data.date, data.time);

  // Le secteur retenu est le plus proche à vol d'oiseau ; il ne sert qu'à signaler
  // « hors secteur habituel », jamais à éliminer un opérateur (§4).
  const sectors = await prisma.sector.findMany({ where: { active: true } });
  const nearest = sectors
    .map((s) => ({
      id: s.id,
      d: (s.centroidLat - location.lat) ** 2 + (s.centroidLng - location.lng) ** 2,
    }))
    .sort((a, b) => a.d - b.d)[0];

  const result = await runAssignment({
    request: {
      address: fullAddress,
      lat: location.lat,
      lng: location.lng,
      start,
      durationMin: pricing.totalDurationMin,
      serviceId: data.serviceId,
      sectorId: nearest?.id ?? null,
    },
    requestedByUserId: user.userId,
  });

  return {
    ok: true,
    runId: result.runId,
    candidates: result.candidates,
    rejected: result.rejected,
    quote: {
      serviceName: pricing.serviceName,
      totalCents: pricing.totalCents,
      totalDurationMin: pricing.totalDurationMin,
    },
    location,
    start: start.toISOString(),
    trafficAware: result.trafficAware,
    durationMs: result.durationMs,
  };
}

const createSchema = searchSchema.extend({
  firstName: z.string().min(1, "Prénom manquant"),
  lastName: z.string().min(1, "Nom manquant"),
  phone: z.string().min(6, "Téléphone manquant"),
  email: z.string().email("E-mail invalide").or(z.literal("")).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  accessNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  operatorId: z.string().min(1, "Sélectionnez un opérateur"),
  leadId: z.string().optional(),
  runId: z.string().min(1),
  assignmentScore: z.number().int().min(0).max(100).nullable(),
  manualOverride: z.boolean(),
});

export type CreateInput = z.input<typeof createSchema>;
export type CreateResult = { ok: true; id: string; reference: string } | { ok: false; error: string };

/** `XD-AAMM-NNNN`, séquentiel par mois. */
async function nextReference(start: Date): Promise<string> {
  const prefix = `XD-${String(start.getUTCFullYear()).slice(2)}${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  const last = await prisma.appointment.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const next = last ? Number(last.reference.split("-")[2]) + 1 : 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}

export async function createAppointment(input: CreateInput): Promise<CreateResult> {
  const user = await requireBackOffice();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }
  const data = parsed.data;

  const fullAddress = `${data.addressLine1}, ${data.postalCode} ${data.city}`;
  const location = await geocode(fullAddress);
  if (!location) return { ok: false, error: "Adresse introuvable au moment de la validation." };

  let pricing;
  try {
    pricing = await quote({
      serviceId: data.serviceId,
      vehicleClass: data.vehicleClass,
      optionIds: data.optionIds,
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  const start = fromLocalDateTimeInput(data.date, data.time);
  const end = new Date(start.getTime() + pricing.totalDurationMin * 60_000);

  const operator = await prisma.operator.findUnique({
    where: { id: data.operatorId },
    select: { id: true, homeSectorId: true, firstName: true, lastName: true },
  });
  if (!operator) return { ok: false, error: "Opérateur introuvable." };

  // Le téléphone identifie le client : un appelant déjà connu ne doit pas créer de doublon (§23).
  const customer =
    (await prisma.customer.findFirst({ where: { phone: data.phone } })) ??
    (await prisma.customer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email || null,
      },
    }));

  const address =
    (await prisma.customerAddress.findFirst({
      where: { customerId: customer.id, line1: data.addressLine1, postalCode: data.postalCode },
    })) ??
    (await prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        line1: data.addressLine1,
        postalCode: data.postalCode,
        city: data.city,
        lat: location.lat,
        lng: location.lng,
        geocodeAccuracy: location.accuracy,
        accessNotes: data.accessNotes || null,
        isDefault: true,
      },
    }));

  const vehicle =
    (await prisma.customerVehicle.findFirst({
      where: { customerId: customer.id, vehicleClass: data.vehicleClass },
    })) ??
    (await prisma.customerVehicle.create({
      data: {
        customerId: customer.id,
        vehicleClass: data.vehicleClass,
        make: data.make || null,
        model: data.model || null,
      },
    }));


  // Fidélité : la récompense la plus ancienne est consommée d'abord.
  //
  // La remise réduit le total encaissé, donc la commission du §18 porte sur le net :
  // opérateur et X Detailing supportent l'avantage au prorata de leur part. C'est la
  // lecture naturelle de « 18 % du chiffre d'affaires de lavage », mais c'est une
  // décision commerciale — si le réseau veut que X Detailing la supporte seule, c'est
  // ici et dans `server/commission` qu'il faut intervenir.
  const reward = await getAvailableReward(customer.id);
  const discountCents = reward ? rewardDiscountCents(reward, pricing.totalCents) : 0;
  const totalCents = pricing.totalCents - discountCents;

  const { depositCents } = await computeDeposit(totalCents);

  // Calculée hors transaction : une requête sur le client global depuis l'intérieur
  // d'un `$transaction` consomme le budget de temps de celle-ci et la fait expirer.
  const reference = await nextReference(start);

  const appointment = await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        reference,
        customerId: customer.id,
        customerVehicleId: vehicle.id,
        addressId: address.id,
        addressLine1: data.addressLine1,
        postalCode: data.postalCode,
        city: data.city,
        lat: location.lat,
        lng: location.lng,
        accessNotes: data.accessNotes || null,
        serviceId: data.serviceId,
        vehicleClass: data.vehicleClass,
        operatorId: operator.id,
        sectorId: operator.homeSectorId,
        leadId: data.leadId ?? null,
        status: "ASSIGNED",
        // §19 : un RDV issu d'un lead garde sa source, sinon le coût par lead
        // et le CA généré ne peuvent plus être rapprochés.
        source: data.leadId ? "META_LEAD" : "PHONE",
        scheduledStart: start,
        scheduledEnd: end,
        durationMin: pricing.totalDurationMin,
        priceCents: pricing.basePriceCents,
        optionsPriceCents: pricing.optionsPriceCents,
        discountCents,
        totalCents,
        depositCents,
        assignmentScore: data.assignmentScore,
        assignmentRunId: data.runId,
        internalNotes: data.internalNotes || null,
        options: {
          create: pricing.options.map((o) => ({
            optionId: o.id,
            priceCents: o.priceCents,
            durationMin: o.durationMin,
          })),
        },
      },
      select: { id: true, reference: true },
    });

    await tx.appointmentEvent.createMany({
      data: [
        {
          appointmentId: created.id,
          type: "CREATED",
          userId: user.userId,
          note: "Prise de rendez-vous téléphonique (§3)",
        },
        {
          appointmentId: created.id,
          type: "ASSIGNED",
          userId: user.userId,
          operatorId: operator.id,
          note: data.manualOverride
            ? "Opérateur choisi manuellement par le back-office"
            : `Proposition du moteur retenue (score ${data.assignmentScore ?? "n/c"})`,
        },
      ],
    });

    if (reward) {
      await tx.customerReward.update({
        where: { id: reward.id },
        data: { usedAt: new Date(), usedOnAppointmentId: created.id },
      });
    }

    await tx.assignmentRun.update({
      where: { id: data.runId },
      data: {
        appointmentId: created.id,
        chosenOperatorId: operator.id,
        manualOverride: data.manualOverride,
      },
    });

    if (data.leadId) {
      await tx.lead.update({
        where: { id: data.leadId },
        data: { status: "BOOKED", customerId: customer.id },
      });
    }

    return created;
  });

  await recordAudit({
    actorUserId: user.userId,
    actorLabel: user.name,
    action: "RDV_CREE",
    entityType: "Appointment",
    entityId: appointment.id,
    after: {
      reference: appointment.reference,
      operator: `${operator.firstName} ${operator.lastName}`,
      start: start.toISOString(),
      totalCents: pricing.totalCents,
      manualOverride: data.manualOverride,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/planning");

  return { ok: true, id: appointment.id, reference: appointment.reference };
}
