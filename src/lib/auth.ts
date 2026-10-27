import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "xd_session";
const DUREE_SESSION_SECONDES = 60 * 60 * 12; // 12h

export type { RoleUtilisateur } from "@/lib/types";
import type { RoleUtilisateur } from "@/lib/types";

export type SessionPayload = {
  sub: string; // Utilisateur.id
  role: RoleUtilisateur;
  operateurId: string | null;
  email: string;
};

function secret() {
  const valeur = process.env.SESSION_SECRET;
  if (!valeur) {
    throw new Error("SESSION_SECRET manquant : voir .env.example");
  }
  return new TextEncoder().encode(valeur);
}

export async function hashMotDePasse(motDePasse: string) {
  return bcrypt.hash(motDePasse, 12);
}

export async function verifierMotDePasse(motDePasse: string, hash: string) {
  return bcrypt.compare(motDePasse, hash);
}

export async function signerSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION_SECONDES}s`)
    .sign(secret());
}

export async function verifierSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub as string,
      role: payload.role as RoleUtilisateur,
      operateurId: (payload.operateurId as string | null) ?? null,
      email: payload.email as string,
    };
    } catch {
      return null;
    }
}

export const DUREE_COOKIE_SECONDES = DUREE_SESSION_SECONDES;

// Interrupteur de phase de développement : désactivé par défaut (aucune
// variable à configurer) pour que la preview publique ouvre directement le
// back-office. L'architecture RBAC (rôles, middleware, vérifications par
// page) n'est pas modifiée — seulement court-circuitée tant que cette
// fonction renvoie true. Positionner DISABLE_AUTH="false" pour repasser en
// authentification réelle avant toute mise en production.
export function authDesactivee() {
  return process.env.DISABLE_AUTH !== "false";
}

// Cookie "persona de démo" (page /demo) : contrairement au cookie de vraie
// session, il n'est PAS signé — il n'a aucune valeur en dehors du mode
// DISABLE_AUTH (le middleware l'ignore totalement dès que l'authentification
// réelle est réactivée). Il permet de prévisualiser fidèlement chaque rôle
// (OWNER / COMMERCIAL / OPERATEUR) avec les VRAIES restrictions RBAC
// appliquées, sans passer par un vrai login.
export const DEMO_SESSION_COOKIE = "xd_demo_persona";

export function serialiserPersonaDemo(payload: SessionPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function lirePersonaDemo(valeurCookie: string | undefined): SessionPayload | null {
  if (!valeurCookie) return null;
  try {
    const data = JSON.parse(decodeURIComponent(valeurCookie));
    if (!data || typeof data.role !== "string") return null;
    return {
      sub: typeof data.sub === "string" ? data.sub : "demo",
      role: data.role as RoleUtilisateur,
      operateurId: typeof data.operateurId === "string" ? data.operateurId : null,
      email: typeof data.email === "string" ? data.email : "demo@xdetailing.fr",
    };
  } catch {
    return null;
  }
}

