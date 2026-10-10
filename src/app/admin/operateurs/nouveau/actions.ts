"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { geocode } from "@/server/geocoding";
import { recordAudit } from "@/server/audit";

/** §28 — création d'un opérateur depuis le back-office, immédiatement opérationnel. */

const schema = z.object({
  firstName: z.string().min(1, "Prénom manquant"),
  lastName: z.string().min(1, "Nom manquant"),
  email: z.string().email("E-mail invalide"),
  phone: z.string().min(6, "Téléphone manquant"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
  homeAddress: z.string().min(5, "Adresse de départ manquante"),
  homeSectorId: z.string().min(1, "Secteur de rattachement manquant"),
  coverageSectorIds: z.array(z.string()).min(1, "Sélectionnez au moins une zone d'intervention"),
  serviceIds: z.array(z.string()).min(1, "Sélectionnez au moins une prestation"),
  targetJobsPerDay: z.coerce.number().int().min(1).max(12),
  commissionRate: z.coerce.number().min(0).max(1),
  startMinute: z.coerce.number().int().min(0).max(1440),
  endMinute: z.coerce.number().int().min(0).max(1440),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Sélectionnez au moins un jour"),
  plate: z.string().optional(),
  activateNow: z.boolean(),
});

export type CreateOperatorInput = z.input<typeof schema>;
export type CreateOperatorResult = { ok: true; id: string } | { ok: false; error: string };

export async function createOperator(input: CreateOperatorInput): Promise<CreateOperatorResult> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire incomplet" };
  }
  const data = parsed.data;

  if (data.endMinute <= data.startMinute) {
    return { ok: false, error: "L'heure de fin doit suivre l'heure de début." };
  }

  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) return { ok: false, error: "Un compte existe déjà avec cet e-mail." };

  // Sans coordonnées, l'opérateur ne peut pas entrer dans le moteur d'affectation.
  const home = await geocode(data.homeAddress);
  if (!home) {
    return {
      ok: false,
      error: `Adresse de départ introuvable : « ${data.homeAddress} ». Le moteur en a besoin pour calculer les trajets.`,
    };
  }

  const count = await prisma.operator.count();
  const code = `OP-${String(count + 1).padStart(2, "0")}`;

  // scrypt coûte ~100 ms de CPU : le faire dans la transaction rognerait son budget.
  const passwordHash = await hashPassword(data.password);

  const operator = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        role: "OPERATOR",
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
    });

    const created = await tx.operator.create({
      data: {
        userId: user.id,
        code,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email.toLowerCase(),
        homeAddress: home.formatted,
        homeLat: home.lat,
        homeLng: home.lng,
        homeSectorId: data.homeSectorId,
        status: data.activateNow ? "ACTIVE" : "ONBOARDING",
        commissionRate: data.commissionRate,
        targetJobsPerDay: data.targetJobsPerDay,
        /*
         * Aucune pause déclarée, et ce n'est pas un oubli.
         *
         * Les départs sont fixes — 8 h 30, 11 h 30, 15 h — et une prestation dure deux
         * heures. Celui de 11 h 30 se termine donc à 13 h 30 : la pause 12 h 30 – 13 h 30
         * qui était écrite ici le chevauchait, et le moteur le rejetait. Tout opérateur
         * créé depuis le back-office n'aurait jamais eu que deux départs sur trois, sans
         * que rien ne le signale.
         *
         * Une pause reste possible, mais elle doit être posée hors de la plage
         * 11 h 30 – 13 h 30, sous peine de refermer ce départ.
         */
        workingHours: {
          create: data.weekdays.map((weekday) => ({
            weekday,
            startMinute: data.startMinute,
            endMinute: data.endMinute,
            breakStartMinute: null,
            breakEndMinute: null,
          })),
        },
        coverage: { create: data.coverageSectorIds.map((sectorId) => ({ sectorId })) },
        services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
      select: { id: true },
    });

    if (data.plate?.trim()) {
      await tx.fleetVehicle.create({
        data: {
          plate: data.plate.trim().toUpperCase(),
          status: "ASSIGNED",
          operatorId: created.id,
        },
      });
    }

    return created;
  });

  await recordAudit({
    actorUserId: admin.userId,
    actorLabel: admin.name,
    action: "OPERATEUR_CREE",
    entityType: "Operator",
    entityId: operator.id,
    after: { code, name: `${data.firstName} ${data.lastName}`, status: data.activateNow ? "ACTIVE" : "ONBOARDING" },
  });

  revalidatePath("/admin/operateurs");
  revalidatePath("/admin/planning");

  return { ok: true, id: operator.id };
}
