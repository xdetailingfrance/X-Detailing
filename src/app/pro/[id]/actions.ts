"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireOperator } from "@/lib/auth/guard";
import { performTransition } from "@/server/workflow/state-machine";
import { verifyPhoto } from "@/server/photos";
import { storageProvider } from "@/lib/providers/storage";
import { recordCashPayment, createBalanceLink } from "@/server/payments";
import { raiseAlert } from "@/server/quality/alerts";
import { recordSignature } from "@/server/signature";
import { proposeAdjustment, acceptAdjustment } from "@/server/vehicle-adjustment";
import type { VehicleClass } from "@/generated/prisma/enums";
import type { Transition } from "@/server/workflow/types";

/**
 * Actions de la PWA opérateur (§12 → §17).
 *
 * Toutes passent par `requireOperator` puis par les gardes du workflow : l'interface ne
 * fait que refléter ce que le serveur autorise, elle ne décide de rien.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const TRANSITIONS: Transition[] = [
  "START_TRIP", "ARRIVE", "VALIDATE_PHOTOS_BEFORE", "START_SERVICE",
  "VALIDATE_PHOTOS_AFTER", "OPEN_PAYMENT", "COMPLETE", "NO_SHOW",
];

export async function advance(input: {
  appointmentId: string;
  transition: Transition;
}): Promise<ActionResult> {
  const operator = await requireOperator();

  if (!TRANSITIONS.includes(input.transition)) {
    return { ok: false, error: "Action inconnue." };
  }

  const result = await performTransition({
    appointmentId: input.appointmentId,
    transition: input.transition,
    actor: { userId: operator.userId, label: operator.name, operatorId: operator.operatorId },
  });

  if (!result.ok) {
    // §27 — une étape bloquée par manque de photos remonte au central, pas seulement
    // à l'écran de l'opérateur.
    if (result.code === "PHOTOS_MISSING") {
      await raiseAlert({
        type: "PHOTOS_MISSING",
        severity: "WARNING",
        title: "Photos manquantes",
        message: result.message,
        appointmentId: input.appointmentId,
        operatorId: operator.operatorId,
      });
    }
    return { ok: false, error: result.message };
  }

  revalidatePath(`/pro/${input.appointmentId}`);
  revalidatePath("/pro");
  return { ok: true };
}

// ─── Photos (§13, §15) ──────────────────────────────────────────────────────

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

const photoSchema = z.object({
  appointmentId: z.string().min(1),
  phase: z.enum(["BEFORE", "AFTER"]),
  slot: z.enum(["FRONT_LEFT", "FRONT_RIGHT", "REAR", "INTERIOR", "EXTRA", "DAMAGE"]),
  capturedInApp: z.boolean(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export type UploadResult = { ok: true; photoId: string } | { ok: false; error: string };

export async function uploadPhoto(formData: FormData): Promise<UploadResult> {
  const operator = await requireOperator();

  const parsed = photoSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    phase: formData.get("phase"),
    slot: formData.get("slot"),
    capturedInApp: formData.get("capturedInApp") === "true",
    lat: formData.get("lat") ? Number(formData.get("lat")) : null,
    lng: formData.get("lng") ? Number(formData.get("lng")) : null,
  });
  if (!parsed.success) return { ok: false, error: "Requête invalide." };
  const data = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier reçu." };
  if (!ACCEPTED_TYPES.has(file.type)) return { ok: false, error: "Format d'image non accepté." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Photo trop lourde (12 Mo maximum)." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: data.appointmentId },
    select: {
      id: true, operatorId: true, status: true, arrivedAt: true, startedAt: true,
      customerVehicleId: true,
    },
  });

  if (!appointment) return { ok: false, error: "Rendez-vous introuvable." };
  if (appointment.operatorId !== operator.operatorId) {
    return { ok: false, error: "Ce rendez-vous n'est pas le vôtre." };
  }

  // La phase doit correspondre à l'étape en cours : on ne prend pas de photos « après »
  // avant d'avoir démarré la prestation (§12).
  if (data.phase === "BEFORE" && appointment.status !== "ARRIVED") {
    return { ok: false, error: "Validez votre arrivée avant de photographier le véhicule." };
  }
  if (data.phase === "AFTER" && appointment.status !== "IN_PROGRESS") {
    return { ok: false, error: "La prestation doit être démarrée avant les photos après." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const now = new Date();

  const verdict = verifyPhoto({
    buffer,
    arrivedAt: data.phase === "BEFORE" ? appointment.arrivedAt : appointment.startedAt,
    now,
    declaredInApp: data.capturedInApp,
  });

  if (!verdict.accepted) return { ok: false, error: verdict.reason ?? "Photo refusée." };

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const stored = await storageProvider().put(buffer, {
    extension,
    prefix: `${appointment.id}/${data.phase.toLowerCase()}`,
  });

  // Une seule photo par emplacement : reprendre écrase l'ancienne.
  const existing = await prisma.photo.findFirst({
    where: { appointmentId: appointment.id, phase: data.phase, slot: data.slot },
    select: { id: true, path: true },
  });
  if (existing) {
    await storageProvider().remove(existing.path);
    await prisma.photo.delete({ where: { id: existing.id } });
  }

  const photo = await prisma.photo.create({
    data: {
      appointmentId: appointment.id,
      // §26 — la photo est rattachée au véhicule, pas seulement au rendez-vous :
      // c'est ce qui construit sa fiche digitale permanente.
      customerVehicleId: appointment.customerVehicleId,
      phase: data.phase,
      slot: data.slot,
      path: stored.key,
      bytes: stored.bytes,
      hash: stored.sha256,
      takenAt: now,
      exifTakenAt: verdict.exifTakenAt,
      lat: data.lat,
      lng: data.lng,
      capturedInApp: data.capturedInApp,
    },
    select: { id: true },
  });

  if (verdict.flags.length > 0) {
    await prisma.appointmentEvent.create({
      data: {
        appointmentId: appointment.id,
        type: "NOTE",
        operatorId: operator.operatorId,
        note: `Photo ${data.phase} ${data.slot} : ${verdict.flags.join(", ")}`,
      },
    });
  }

  revalidatePath(`/pro/${appointment.id}`);
  return { ok: true, photoId: photo.id };
}

export async function deletePhoto(input: { photoId: string }): Promise<ActionResult> {
  const operator = await requireOperator();

  const photo = await prisma.photo.findUnique({
    where: { id: input.photoId },
    select: { id: true, path: true, appointmentId: true, appointment: { select: { operatorId: true, status: true } } },
  });

  if (!photo || photo.appointment.operatorId !== operator.operatorId) {
    return { ok: false, error: "Photo introuvable." };
  }
  // Une photo déjà validée fait partie de la preuve : elle ne se supprime plus (§30).
  if (!["ARRIVED", "IN_PROGRESS"].includes(photo.appointment.status)) {
    return { ok: false, error: "Cette photo est validée et ne peut plus être supprimée." };
  }

  await storageProvider().remove(photo.path);
  await prisma.photo.delete({ where: { id: photo.id } });

  revalidatePath(`/pro/${photo.appointmentId}`);
  return { ok: true };
}

// ─── §31 — contrôle du véhicule à l'arrivée ─────────────────────────────────

const VEHICLE_CLASSES = [
  "CITADINE", "BERLINE", "BREAK", "SUV", "QUATRE_X_QUATRE", "UTILITAIRE", "SEPT_PLACES",
] as const;

const adjustSchema = z.object({
  appointmentId: z.string().min(1),
  toClass: z.enum(VEHICLE_CLASSES),
  reason: z.string().max(200).optional(),
  make: z.string().max(40).optional(),
  model: z.string().max(40).optional(),
});

export type AdjustResult =
  | { ok: true; fromLabel: string; toLabel: string; fromCents: number; toCents: number; deltaCents: number }
  | { ok: false; error: string };

export async function reclassifyVehicle(
  input: z.input<typeof adjustSchema>,
): Promise<AdjustResult> {
  const operator = await requireOperator();

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête invalide." };

  const result = await proposeAdjustment({
    appointmentId: parsed.data.appointmentId,
    operatorId: operator.operatorId,
    toClass: parsed.data.toClass as VehicleClass,
    reason: parsed.data.reason,
    make: parsed.data.make,
    model: parsed.data.model,
  });

  if (!result.ok) return result;

  revalidatePath(`/pro/${parsed.data.appointmentId}`);
  const { proposal } = result;
  return {
    ok: true,
    fromLabel: proposal.fromLabel,
    toLabel: proposal.toLabel,
    fromCents: proposal.fromCents,
    toCents: proposal.toCents,
    deltaCents: proposal.deltaCents,
  };
}

export async function confirmReclassification(input: {
  appointmentId: string;
}): Promise<ActionResult> {
  const operator = await requireOperator();

  const result = await acceptAdjustment({
    appointmentId: input.appointmentId,
    operatorId: operator.operatorId,
  });

  if (!result.ok) return { ok: false, error: result.error ?? "Échec" };

  revalidatePath(`/pro/${input.appointmentId}`);
  return { ok: true };
}

// ─── §32 — signature du bon de prise en charge ──────────────────────────────

const signSchema = z.object({
  appointmentId: z.string().min(1),
  paths: z.string().min(1).max(100_000),
  signerName: z.string().min(2).max(80),
});

export async function signHandover(input: z.input<typeof signSchema>): Promise<ActionResult> {
  const operator = await requireOperator();

  const parsed = signSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Signature ou nom du signataire manquant." };
  }

  const result = await recordSignature({
    appointmentId: parsed.data.appointmentId,
    operatorId: operator.operatorId,
    paths: parsed.data.paths,
    signerName: parsed.data.signerName,
  });

  if (!result.ok) return result;

  revalidatePath(`/pro/${parsed.data.appointmentId}`);
  return { ok: true };
}

// ─── §36 — le client refuse de payer ────────────────────────────────────────

export async function declareUnpaid(input: { appointmentId: string }): Promise<ActionResult> {
  const operator = await requireOperator();

  const result = await performTransition({
    appointmentId: input.appointmentId,
    transition: "MARK_UNPAID",
    actor: { userId: operator.userId, label: operator.name, operatorId: operator.operatorId },
    note: "Client refusant de régler le solde",
  });

  if (!result.ok) return { ok: false, error: result.message };

  revalidatePath(`/pro/${input.appointmentId}`);
  revalidatePath("/pro");
  return { ok: true };
}

// ─── Encaissement (§16) ─────────────────────────────────────────────────────

export type CashActionResult =
  | { ok: true; discrepancyCents: number }
  | { ok: false; error: string };

export async function collectCash(input: {
  appointmentId: string;
  expectedCents: number;
  receivedCents: number;
}): Promise<CashActionResult> {
  const operator = await requireOperator();

  const result = await recordCashPayment({
    appointmentId: input.appointmentId,
    operatorId: operator.operatorId,
    expectedCents: input.expectedCents,
    receivedCents: input.receivedCents,
    actor: { userId: operator.userId, label: operator.name },
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/pro/${input.appointmentId}`);
  return { ok: true, discrepancyCents: result.discrepancyCents };
}

export type LinkActionResult = { ok: true; url: string } | { ok: false; error: string };

export async function sendPaymentLink(input: { appointmentId: string }): Promise<LinkActionResult> {
  const operator = await requireOperator();

  const result = await createBalanceLink({
    appointmentId: input.appointmentId,
    operatorId: operator.operatorId,
    actor: { userId: operator.userId, label: operator.name },
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/pro/${input.appointmentId}`);
  return { ok: true, url: result.url };
}

