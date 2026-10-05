"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { geocode } from "@/server/geocoding";
import { quote, PricingError } from "@/server/pricing";
import { DEPARTURE } from "@/server/tarifs";
import { roadRoute, estimateLeg } from "@/lib/providers/geo";
import { findAvailableSlots, type SlotOption } from "@/server/assignment/availability";
import { findImmediateSlots } from "@/server/dispatch/wash-now";
import { runAssignment } from "@/server/assignment/service";
import { recordAudit } from "@/server/audit";
import { paymentProvider } from "@/lib/providers/payments";
import { getAvailableReward, rewardDiscountCents } from "@/server/loyalty";
import { checkVoucher } from "@/server/vouchers";

/** Le code a été dépensé entre la vérification et l'écriture : la transaction s'annule. */
class VoucherAlreadyUsed extends Error {}
import { computeDeposit } from "@/server/quoting";
import { analyzePhotos, linkAnalysisToAppointment, type AnalysisOutcome } from "@/server/photo-analysis";
import { visionProvider } from "@/lib/providers/vision";
import { startOfLocalDay } from "@/server/time";

/**
 * Tunnel de réservation client (§2).
 *
 * Ces actions sont accessibles sans authentification. Les entrées sont donc validées
 * strictement, et rien de sensible n'est renvoyé : la recherche de créneaux expose des
 * horaires, jamais l'identité ni la position des opérateurs.
 *
 * À AJOUTER AVANT PRODUCTION : une limitation de débit par IP sur `lookupSlots` et
 * `confirmBooking` — le géocodage et le moteur sont coûteux, et ces routes sont publiques.
 */

const VEHICLE_CLASSES = [
  "CITADINE", "BERLINE", "BREAK", "SUV", "QUATRE_X_QUATRE", "UTILITAIRE", "SEPT_PLACES",
] as const;

const bookingCore = z.object({
  vehicleClass: z.enum(VEHICLE_CLASSES),
  serviceId: z.string().min(1),
  optionIds: z.array(z.string()).max(10).default([]),
  addressLine1: z.string().min(3, "Indiquez votre rue et votre numéro"),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal invalide"),
  city: z.string().min(2, "Indiquez votre ville"),
  accessNotes: z.string().max(500).optional(),
});

export type SlotLookup =
  | { ok: false; error: string }
  | {
      ok: true;
      slots: SlotOption[];
      formattedAddress: string;
      lat: number;
      lng: number;
      durationMin: number;
      totalCents: number;
      /** Distance routière depuis le point de départ, et le supplément correspondant. */
      travelKm: number;
      travelCents: number;
      operatorsConsidered: number;
    };

/**
 * Distance routière entre le point de départ du réseau et le client.
 *
 * La Géoplateforme peut ne pas répondre ; on retombe alors sur l'estimation géométrique
 * plutôt que de ne rien facturer. Un trajet gratuit par défaut de service se paierait
 * sur chaque réservation, et personne ne le verrait passer.
 */
async function roadKmToClient(location: { lat: number; lng: number }): Promise<number> {
  const route = await roadRoute(DEPARTURE, location);
  return route?.km ?? estimateLeg(DEPARTURE, location, new Date()).km;
}

const lookupSchema = bookingCore.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
});

export async function lookupSlots(input: z.input<typeof lookupSchema>): Promise<SlotLookup> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }
  const data = parsed.data;

  const fullAddress = `${data.addressLine1}, ${data.postalCode} ${data.city}`;
  const location = await geocode(fullAddress);
  if (!location) {
    return {
      ok: false,
      error: `Nous n'avons pas trouvé « ${fullAddress} ». Vérifiez le numéro et la ville, ou appelez-nous.`,
    };
  }

  let pricing;
  try {
    pricing = await quote({
      serviceId: data.serviceId,
      vehicleClass: data.vehicleClass,
      optionIds: data.optionIds,
      roadKm: await roadKmToClient(location),
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  const day = startOfLocalDay(new Date(`${data.date}T12:00:00Z`));

  const availability = await findAvailableSlots({
    lat: location.lat,
    lng: location.lng,
    address: fullAddress,
    day,
    durationMin: pricing.totalDurationMin,
    serviceId: data.serviceId,
  });

  return {
    ok: true,
    slots: availability.slots,
    formattedAddress: location.formatted,
    lat: location.lat,
    lng: location.lng,
    durationMin: pricing.totalDurationMin,
    totalCents: pricing.totalCents,
    travelKm: pricing.travelKm ?? 0,
    travelCents: pricing.travelCents,
    operatorsConsidered: availability.operatorsConsidered,
  };
}

/**
 * §7 — « Laver maintenant ». Même validation que la recherche de créneaux : seul
 * l'horizon change.
 */
export async function lookupNow(input: z.input<typeof bookingCore>): Promise<SlotLookup> {
  const parsed = bookingCore.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }
  const data = parsed.data;

  const fullAddress = `${data.addressLine1}, ${data.postalCode} ${data.city}`;
  const location = await geocode(fullAddress);
  if (!location) {
    return { ok: false, error: `Nous n'avons pas trouvé « ${fullAddress} ».` };
  }

  let pricing;
  try {
    pricing = await quote({
      serviceId: data.serviceId,
      vehicleClass: data.vehicleClass,
      optionIds: data.optionIds,
      roadKm: await roadKmToClient(location),
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  const immediate = await findImmediateSlots({
    lat: location.lat,
    lng: location.lng,
    address: fullAddress,
    durationMin: pricing.totalDurationMin,
    serviceId: data.serviceId,
  });

  if (!immediate.available) {
    return { ok: false, error: immediate.reason ?? "Aucun opérateur disponible maintenant." };
  }

  return {
    ok: true,
    slots: immediate.slots.map((slot) => ({
      start: slot.start,
      end: new Date(
        new Date(slot.start).getTime() + pricing.totalDurationMin * 60_000,
      ).toISOString(),
      label: slot.label,
      bestScore: 0,
      operatorCount: slot.operatorCount,
      travelMin: slot.travelMin,
    })),
    formattedAddress: location.formatted,
    lat: location.lat,
    lng: location.lng,
    durationMin: pricing.totalDurationMin,
    totalCents: pricing.totalCents,
    travelKm: pricing.travelKm ?? 0,
    travelCents: pricing.travelCents,
    operatorsConsidered: immediate.slots.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §19 — ANALYSE DES PHOTOS
// ═══════════════════════════════════════════════════════════════════════════

export type AnalysisAvailability = { available: boolean };

export async function isAnalysisAvailable(): Promise<AnalysisAvailability> {
  return { available: visionProvider().available };
}

const ACCEPTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Analyse les photos envoyées pendant le parcours.
 *
 * Le résultat ne modifie **jamais** le devis : il rend des constats et des options
 * proposées. L'ajout reste un geste du client (§19).
 */
export async function analyzeQuotePhotos(formData: FormData): Promise<AnalysisOutcome> {
  const serviceId = String(formData.get("serviceId") ?? "");
  const vehicleLabel = String(formData.get("vehicleLabel") ?? "Véhicule");
  const quoteToken = String(formData.get("quoteToken") ?? "") || null;

  if (!serviceId) {
    return { ok: false, reason: "ERROR", message: "Prestation manquante." };
  }

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return { ok: false, reason: "NO_IMAGES", message: "Aucune photo reçue." };
  }

  const images = [];
  for (const file of files.slice(0, 6)) {
    if (!ACCEPTED_IMAGES.has(file.type)) continue;
    images.push({ buffer: Buffer.from(await file.arrayBuffer()), mediaType: file.type });
  }

  return analyzePhotos({ images, serviceId, vehicleLabel, quoteToken });
}

const confirmSchema = bookingCore.extend({
  start: z.string().datetime(),
  firstName: z.string().min(1, "Indiquez votre prénom"),
  lastName: z.string().min(1, "Indiquez votre nom"),
  phone: z.string().min(6, "Indiquez un numéro de téléphone"),
  email: z.string().email("Adresse e-mail invalide"),
  make: z.string().max(40).optional(),
  model: z.string().max(40).optional(),
  marketingOptIn: z.boolean().default(false),
  /** Rattache l'analyse faite pendant le parcours au rendez-vous créé (§19). */
  quoteToken: z.string().optional(),
  /** Code de remise reçu par e-mail (§23). Revérifié ici, jamais cru sur parole. */
  voucherCode: z.string().trim().max(20).optional(),
});

export type ConfirmResult =
  | { ok: false; error: string; slotTaken?: boolean }
  /** `token` et non `reference` : la référence est séquentielle, donc énumérable. */
  | { ok: true; reference: string; token: string };

/** `XD-AAMM-NNNN`, séquentiel par mois. */
async function nextReference(start: Date): Promise<string> {
  const prefix = `XD-${String(start.getUTCFullYear()).slice(2)}${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  const last = await prisma.appointment.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  return `${prefix}-${String(last ? Number(last.reference.split("-")[2]) + 1 : 1).padStart(4, "0")}`;
}

export async function confirmBooking(input: z.input<typeof confirmSchema>): Promise<ConfirmResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }
  const data = parsed.data;

  const fullAddress = `${data.addressLine1}, ${data.postalCode} ${data.city}`;
  const location = await geocode(fullAddress);
  if (!location) return { ok: false, error: "Adresse introuvable. Appelez-nous pour réserver." };

  let pricing;
  try {
    pricing = await quote({
      serviceId: data.serviceId,
      vehicleClass: data.vehicleClass,
      optionIds: data.optionIds,
      roadKm: await roadKmToClient(location),
    });
  } catch (error) {
    if (error instanceof PricingError) return { ok: false, error: error.message };
    throw error;
  }

  const start = new Date(data.start);
  if (start.getTime() < Date.now()) {
    return { ok: false, error: "Ce créneau est déjà passé.", slotTaken: true };
  }

  // La liste de créneaux est un pré-filtre calculé sur une heure de référence unique.
  // C'est ici, à l'heure exacte, que le moteur complet fait autorité (§4).
  const assignment = await runAssignment({
    request: {
      address: fullAddress,
      lat: location.lat,
      lng: location.lng,
      start,
      durationMin: pricing.totalDurationMin,
      serviceId: data.serviceId,
    },
    requestedByUserId: null,
  });

  const chosen = assignment.candidates[0];
  if (!chosen) {
    return {
      ok: false,
      slotTaken: true,
      error: "Ce créneau vient d'être pris. Choisissez-en un autre — la liste est à jour.",
    };
  }

  const operator = await prisma.operator.findUniqueOrThrow({
    where: { id: chosen.operatorId },
    select: { id: true, homeSectorId: true, firstName: true, lastName: true },
  });

  const customer =
    (await prisma.customer.findFirst({ where: { phone: data.phone } })) ??
    (await prisma.customer.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        marketingOptIn: data.marketingOptIn,
      },
    }));

  const address =
    (await prisma.customerAddress.findFirst({
      where: { customerId: customer.id, line1: data.addressLine1, postalCode: data.postalCode },
    })) ??
    (await prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        label: "Domicile",
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
  const rewardCents = reward ? rewardDiscountCents(reward, pricing.totalCents) : 0;

  // Le code de remise est revérifié ici, à l'heure de la confirmation : la validation
  // affichée pendant la saisie est un confort, celle-ci fait foi. Fidélité et bon ne se
  // cumulent pas — on applique la plus favorable au client, et on le dit.
  let voucherCents = 0;
  let voucherId: string | null = null;

  if (data.voucherCode) {
    const check = await checkVoucher(data.voucherCode, pricing.totalCents, customer.email);
    if (!check.ok) return { ok: false, error: check.error };
    voucherCents = check.discountCents;
    voucherId = check.id;
  }

  const useVoucher = voucherCents > rewardCents;
  const discountCents = useVoucher ? voucherCents : rewardCents;
  const totalCents = pricing.totalCents - discountCents;

  const { depositCents } = await computeDeposit(totalCents);
  const reference = await nextReference(start);

  let appointment;
  try {
    appointment = await prisma.$transaction(async (tx) => {
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
          status: "ASSIGNED",
          source: "WEB",
          scheduledStart: start,
          scheduledEnd: new Date(start.getTime() + pricing.totalDurationMin * 60_000),
          durationMin: pricing.totalDurationMin,
          priceCents: pricing.basePriceCents,
          optionsPriceCents: pricing.optionsPriceCents,
          discountCents,
          totalCents,
          depositCents,
          assignmentScore: chosen.score,
          assignmentRunId: assignment.runId,
          travelMinEstimate: chosen.travelMin,
          options: {
            create: pricing.options.map((option) => ({
              optionId: option.id,
              priceCents: option.priceCents,
              durationMin: option.durationMin,
            })),
          },
        },
        select: { id: true, reference: true, publicToken: true },
      });

      await tx.appointmentEvent.createMany({
        data: [
          { appointmentId: created.id, type: "CREATED", note: "Réservation depuis le site client (§2)" },
          {
            appointmentId: created.id,
            type: "ASSIGNED",
            operatorId: operator.id,
            note: `Proposition du moteur retenue (score ${chosen.score})`,
          },
        ],
      });

      await tx.assignmentRun.update({
        where: { id: assignment.runId },
        data: { appointmentId: created.id, chosenOperatorId: operator.id, manualOverride: false },
      });

      // On ne consomme que la remise réellement appliquée : l'autre reste disponible.
      if (reward && !useVoucher) {
        await tx.customerReward.update({
          where: { id: reward.id },
          data: { usedAt: new Date(), usedOnAppointmentId: created.id },
        });
      }

      if (voucherId && useVoucher) {
        // Condition sur `usedAt: null` : deux réservations simultanées avec le même code
        // ne peuvent pas le dépenser deux fois.
        const { count } = await tx.voucher.updateMany({
          where: { id: voucherId, usedAt: null },
          data: { usedAt: new Date(), appointmentId: created.id },
        });
        if (count !== 1) throw new VoucherAlreadyUsed();
      }

      return created;
    });
  } catch (error) {
    if (error instanceof VoucherAlreadyUsed) {
      return { ok: false, error: "Ce code vient d'être utilisé. Réessayez sans le code." };
    }
    throw error;
  }

  // Acompte (§2). Aucun prestataire de paiement n'est acté : le lien pointe vers une page
  // interne tant que le §38 point 5 — qui encaisse, TVA, reversements — n'est pas tranché.
  const link = await paymentProvider().createPaymentLink({
    appointmentReference: appointment.reference,
    amountCents: depositCents,
    label: `Acompte ${pricing.serviceName}`,
    customerEmail: data.email,
    customerPhone: data.phone,
  });

  await prisma.payment.create({
    data: {
      appointmentId: appointment.id,
      kind: "DEPOSIT",
      method: "CARD_LINK",
      status: "PENDING",
      beneficiary: "XDETAILING",
      amountCents: depositCents,
      providerRef: link.providerRef,
      providerPayload: { url: link.url },
    },
  });

  if (data.quoteToken) {
    await linkAnalysisToAppointment(data.quoteToken, appointment.id);
  }

  await recordAudit({
    actorUserId: null,
    actorLabel: `${data.firstName} ${data.lastName} (site client)`,
    action: "RDV_CREE",
    entityType: "Appointment",
    entityId: appointment.id,
    after: {
      reference: appointment.reference,
      operator: `${operator.firstName} ${operator.lastName}`,
      start: start.toISOString(),
      totalCents: pricing.totalCents,
      source: "WEB",
    },
  });

  return { ok: true, reference: appointment.reference, token: appointment.publicToken };
}

/**
 * Vérifie un code de remise pendant la saisie, sans le consommer (§23).
 *
 * Le client doit voir le montant remisé avant de confirmer — le §9 du cahier de
 * refonte l'exige : « la personne doit toujours savoir le prix ». La vérification qui
 * fait foi reste celle de `confirmBooking`, rejouée à l'écriture.
 */
export async function checkVoucherCode(input: {
  code: string;
  serviceId: string;
  vehicleClass: string;
  optionIds: string[];
  email?: string;
}): Promise<{ ok: true; discountCents: number; percentOff: number } | { ok: false; error: string }> {
  const parsed = z
    .object({
      serviceId: z.string().min(1),
      vehicleClass: z.enum(VEHICLE_CLASSES),
      optionIds: z.array(z.string()).max(10).default([]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez d'abord une prestation." };

  let pricing;
  try {
    pricing = await quote({
      serviceId: parsed.data.serviceId,
      vehicleClass: parsed.data.vehicleClass,
      optionIds: parsed.data.optionIds,
    });
  } catch {
    return { ok: false, error: "Tarif indisponible pour cette prestation." };
  }

  const result = await checkVoucher(input.code, pricing.totalCents, input.email);
  if (!result.ok) return result;

  return { ok: true, discountCents: result.discountCents, percentOff: result.percentOff };
}
