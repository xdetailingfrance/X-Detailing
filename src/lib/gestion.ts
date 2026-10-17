import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Accès à la page de gestion — un mot de passe, un cookie.
 *
 * Il n'y a qu'une personne derrière cette page : un mot de passe partagé, posé dans
 * l'environnement, suffit. Une fois saisi, le navigateur garde un jeton dérivé du
 * mot de passe (HMAC) — jamais le mot de passe lui-même — pendant trente jours.
 * Changer le mot de passe invalide tous les jetons d'un coup.
 *
 * Les comparaisons sont à temps constant : on ne laisse pas deviner un mot de
 * passe lettre par lettre en chronométrant les réponses.
 */

const COOKIE = "xd_gestion";
const LONGUEUR_MINIMALE = 8;

/** Le mot de passe configuré, ou `null` s'il est absent ou trop court pour servir. */
export function motDePasseConfigure(): string | null {
  const valeur = process.env.GESTION_MOT_DE_PASSE?.trim();
  return valeur && valeur.length >= LONGUEUR_MINIMALE ? valeur : null;
}

function egal(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function jeton(motDePasse: string): string {
  return createHmac("sha256", motDePasse).update("xd-gestion-v1").digest("hex");
}

export function motDePasseValide(saisie: string): boolean {
  const attendu = motDePasseConfigure();
  return attendu !== null && egal(saisie, attendu);
}

export async function accesAutorise(): Promise<boolean> {
  const attendu = motDePasseConfigure();
  if (!attendu) return false;
  const valeur = (await cookies()).get(COOKIE)?.value;
  return Boolean(valeur) && egal(valeur!, jeton(attendu));
}

export async function ouvrirSession(motDePasse: string): Promise<void> {
  (await cookies()).set(COOKIE, jeton(motDePasse), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/gestion",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function fermerSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", { path: "/gestion", maxAge: 0 });
}
