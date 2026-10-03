import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

/**
 * Sessions signées en cookie httpOnly (§31).
 *
 * Pas de table de sessions : le jeton porte l'identité et le rôle, la révocation passe
 * par `User.active`, vérifié à chaque chargement de page protégée.
 */

const COOKIE_NAME = "xd_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  userId: string;
  role: Role;
  name: string;
  operatorId: string | null;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum)");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      role: payload.role as Role,
      name: String(payload.name),
      operatorId: (payload.operatorId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
