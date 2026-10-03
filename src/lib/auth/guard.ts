import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { readSession, type SessionPayload } from "./session";

/**
 * Contrôle d'accès par rôle (§31).
 *
 * Le rôle est relu en base à chaque chargement : désactiver un compte doit couper
 * l'accès immédiatement, pas à l'expiration du jeton.
 */

export type CurrentUser = SessionPayload & { email: string };

export async function currentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, active: true, firstName: true, lastName: true },
  });

  if (!user || !user.active) return null;

  return {
    userId: user.id,
    role: user.role,
    name: `${user.firstName} ${user.lastName}`,
    operatorId: session.operatorId,
    email: user.email,
  };
}

export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  if (roles && !roles.includes(user.role)) redirect("/connexion?erreur=acces");
  return user;
}

/** Back-office : le patron et les conseillers téléphone (§3). */
export const requireBackOffice = () => requireUser(["ADMIN", "DISPATCHER"]);
export const requireAdmin = () => requireUser(["ADMIN"]);

export type CustomerUser = CurrentUser & { customerId: string };

/** §24 — espace client. Le compte est rattaché à une fiche CRM, pas l'inverse. */
export async function requireCustomer(): Promise<CustomerUser> {
  const user = await requireUser(["CUSTOMER"]);

  const customer = await prisma.customer.findFirst({
    where: { userId: user.userId },
    select: { id: true },
  });

  if (!customer) redirect("/espace");
  return { ...user, customerId: customer.id };
}

export type OperatorUser = CurrentUser & { operatorId: string };

/**
 * PWA opérateur. Un compte `OPERATOR` sans fiche opérateur rattachée n'a rien à y faire :
 * toutes les requêtes du workflow sont filtrées par `operatorId`.
 */
export async function requireOperator(): Promise<OperatorUser> {
  const user = await requireUser(["OPERATOR"]);
  if (!user.operatorId) redirect("/connexion?erreur=acces");
  return user as OperatorUser;
}
