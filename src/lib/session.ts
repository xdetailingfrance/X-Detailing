import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  DEMO_SESSION_COOKIE,
  verifierSession,
  lirePersonaDemo,
  authDesactivee,
  type SessionPayload,
} from "@/lib/auth";
import { db } from "@/lib/db";

async function sessionDemoParDefaut(): Promise<SessionPayload> {
  // Aucun persona choisi via /demo : se rattache au compte OWNER existant
  // pour que le back-office et son espace opérateur s'ouvrent pleinement.
  const owner = await db.utilisateur.findFirst({ where: { role: "OWNER", actif: true }, orderBy: { createdAt: "asc" } });
  return {
    sub: owner?.id ?? "demo-owner",
    role: "OWNER",
    operateurId: owner?.operateurId ?? null,
    email: owner?.email ?? "demo@xdetailing.fr",
  };
}

// À utiliser dans les Server Components / route handlers. Ne fait jamais
// confiance à une valeur envoyée par le client : relit et revérifie
// toujours le cookie de session signé (hors mode DISABLE_AUTH, où seul le
// cookie non signé du persona /demo est lu — voir src/middleware.ts).
export async function getSession(): Promise<SessionPayload | null> {
  if (authDesactivee()) {
    const cookieStore = await cookies();
    const persona = lirePersonaDemo(cookieStore.get(DEMO_SESSION_COOKIE)?.value);
    return persona ?? (await sessionDemoParDefaut());
  }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifierSession(token);
}

