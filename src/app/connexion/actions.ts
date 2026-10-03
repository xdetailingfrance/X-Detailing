"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { recordAudit } from "@/server/audit";

export async function signIn(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return "Renseignez votre e-mail et votre mot de passe.";

  const user = await prisma.user.findUnique({
    where: { email },
    include: { operator: { select: { id: true } } },
  });

  // Message identique dans les deux cas : ne pas révéler quels comptes existent.
  const invalid = "E-mail ou mot de passe incorrect.";
  if (!user || !user.active) return invalid;
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    userId: user.id,
    role: user.role,
    name: `${user.firstName} ${user.lastName}`,
    operatorId: user.operator?.id ?? null,
  });
  await recordAudit({
    actorUserId: user.id,
    actorLabel: `${user.firstName} ${user.lastName}`,
    action: "CONNEXION",
    entityType: "User",
    entityId: user.id,
  });

  redirect(user.role === "OPERATOR" ? "/pro" : "/admin");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/connexion");
}
