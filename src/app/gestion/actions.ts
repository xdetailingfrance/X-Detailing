"use server";

import { revalidatePath } from "next/cache";
import { depot } from "@/lib/db";
import { accesAutorise, fermerSession, motDePasseValide, ouvrirSession } from "@/lib/gestion";

/**
 * Les trois gestes de la page de gestion : entrer, sortir, libérer un créneau.
 *
 * Chaque action revérifie l'accès elle-même : une action serveur se déclenche par
 * une simple requête POST, pas seulement depuis le bouton de la page.
 */

export type ConnexionState = { erreur?: string };

export async function seConnecter(
  _previous: ConnexionState,
  formData: FormData,
): Promise<ConnexionState> {
  const saisie = String(formData.get("motDePasse") ?? "");
  if (!motDePasseValide(saisie)) return { erreur: "Mot de passe incorrect." };
  await ouvrirSession(saisie);
  revalidatePath("/gestion");
  return {};
}

export async function seDeconnecter(): Promise<void> {
  await fermerSession();
  revalidatePath("/gestion");
}

export type LiberationState = { ok: true } | { ok: false; erreur: string };

export async function libererCreneau(id: string): Promise<LiberationState> {
  if (!(await accesAutorise())) return { ok: false, erreur: "Session expirée : reconnectez-vous." };
  if (!/^\d{1,20}$/.test(id)) return { ok: false, erreur: "Référence invalide." };

  try {
    await depot().annuler(id);
  } catch (error) {
    console.error("[gestion] libération impossible :", error);
    return { ok: false, erreur: "La base de données ne répond pas. Réessayez dans un instant." };
  }

  revalidatePath("/gestion");
  revalidatePath("/");
  return { ok: true };
}
