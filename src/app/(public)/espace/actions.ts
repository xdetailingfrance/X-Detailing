"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/server/db";
import { createCustomerLinkToken, readCustomerLinkToken, CUSTOMER_LINK_TTL_MINUTES } from "@/lib/auth/customer-link";
import { createSession, destroySession } from "@/lib/auth/session";
import { notificationProvider } from "@/lib/providers/notifications";
import { recordAudit } from "@/server/audit";

/** §24 — accès à l'espace client, sans mot de passe. */

export type LinkRequestResult = { ok: true } | { ok: false; error: string };

const requestSchema = z.object({ email: z.string().email("Adresse e-mail invalide") });

export async function requestAccessLink(
  _prev: LinkRequestResult | null,
  formData: FormData,
): Promise<LinkRequestResult> {
  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Adresse invalide" };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, firstName: true, email: true },
  });

  // Réponse identique que le compte existe ou non : sinon ce formulaire devient un
  // moyen de savoir qui est client.
  if (customer?.email) {
    const token = await createCustomerLinkToken(customer.id);

    await notificationProvider().send({
      channel: "EMAIL",
      recipient: customer.email,
      template: "lien_espace_client",
      payload: {
        prenom: customer.firstName,
        lien: `/espace/connexion?jeton=${token}`,
        validiteMinutes: CUSTOMER_LINK_TTL_MINUTES,
      },
    });
  }

  return { ok: true };
}

export async function openCustomerSession(token: string): Promise<boolean> {
  const customerId = await readCustomerLinkToken(token);
  if (!customerId) return false;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true, firstName: true, lastName: true, companyName: true, email: true,
      user: { select: { id: true, active: true } },
    },
  });

  if (!customer?.email) return false;

  // Le compte utilisateur est créé à la première connexion : inutile d'en fabriquer
  // un à chaque réservation pour des clients qui ne se connecteront jamais.
  const user =
    customer.user ??
    (await prisma.user.create({
      data: {
        email: customer.email.toLowerCase(),
        // Aucun mot de passe utilisable : l'accès passe uniquement par le lien.
        passwordHash: "link-only",
        role: "CUSTOMER",
        firstName: customer.firstName ?? customer.companyName ?? "Client",
        lastName: customer.lastName ?? "",
        customer: { connect: { id: customer.id } },
      },
      select: { id: true, active: true },
    }));

  if (!user.active) return false;

  await createSession({
    userId: user.id,
    role: "CUSTOMER",
    name: customer.companyName ?? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim(),
    operatorId: null,
  });

  await recordAudit({
    actorUserId: user.id,
    actorLabel: customer.email,
    action: "ESPACE_CLIENT_CONNEXION",
    entityType: "Customer",
    entityId: customer.id,
  });

  return true;
}

export async function closeCustomerSession(): Promise<void> {
  await destroySession();
  redirect("/");
}
