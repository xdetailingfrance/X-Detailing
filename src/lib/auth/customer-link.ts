import { SignJWT, jwtVerify } from "jose";

/**
 * Connexion client par lien (§24).
 *
 * Un particulier qui fait laver sa voiture trois fois par an n'a aucune chance de se
 * souvenir d'un mot de passe. Il reçoit un lien, il clique, il est chez lui.
 *
 * Le lien est un jeton signé de quinze minutes — aucune table à purger, et un lien
 * intercepté périme seul.
 */

const AUDIENCE = "espace-client";
const TTL_MINUTES = 15;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum)");
  }
  return new TextEncoder().encode(value);
}

export async function createCustomerLinkToken(customerId: string): Promise<string> {
  return new SignJWT({ customerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(AUDIENCE)
    .setExpirationTime(`${TTL_MINUTES}m`)
    .sign(secret());
}

export async function readCustomerLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    const customerId = payload.customerId;
    return typeof customerId === "string" ? customerId : null;
  } catch {
    return null;
  }
}

export const CUSTOMER_LINK_TTL_MINUTES = TTL_MINUTES;
