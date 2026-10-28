import { get, put } from "@vercel/blob";
import type { AnglePhoto } from "@/lib/types";

/**
 * Photos de prestation — dépôt et lecture.
 *
 * Le stockage est privé : une photo de véhicule montre une plaque
 * d'immatriculation, souvent devant un domicile. Elle n'est donc jamais
 * accessible par son URL, et seule une route qui vérifie l'appelant peut la
 * servir.
 *
 * Sans jeton configuré, le dépôt échoue bruyamment plutôt que de laisser
 * l'opérateur croire que ses photos sont conservées.
 */

export type EtapePhoto = "avant" | "apres";

const TAILLE_MAX = 8 * 1024 * 1024; // 8 Mo : une photo de téléphone compressée
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export function stockagePhotosConfigure() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Emplacement déterministe : un angle ne peut avoir qu'une photo par étape. */
export function cheminPhoto(rdvId: string, etape: EtapePhoto, angle: AnglePhoto) {
  return `rendez-vous/${rdvId}/${etape}/${angle.toLowerCase()}.jpg`;
}

export type DepotPhoto = { ok: true; chemin: string } | { ok: false; error: string };

export async function deposerPhoto(
  rdvId: string,
  etape: EtapePhoto,
  angle: AnglePhoto,
  fichier: File,
): Promise<DepotPhoto> {
  if (!stockagePhotosConfigure()) {
    return { ok: false, error: "Stockage des photos non configuré (BLOB_READ_WRITE_TOKEN)." };
  }
  if (fichier.size === 0) return { ok: false, error: "Fichier vide." };
  if (fichier.size > TAILLE_MAX) {
    return { ok: false, error: `Photo trop lourde (${Math.round(fichier.size / 1024 / 1024)} Mo, maximum 8 Mo).` };
  }
  if (!TYPES_ACCEPTES.includes(fichier.type)) {
    return { ok: false, error: `Format non accepté (${fichier.type || "inconnu"}).` };
  }

  const chemin = cheminPhoto(rdvId, etape, angle);
  // `addRandomSuffix: false` : reprendre une photo écrase la précédente, au
  // lieu d'accumuler des clichés orphelins que plus rien ne référence.
  await put(chemin, fichier, {
    access: "private",
    contentType: fichier.type,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { ok: true, chemin };
}

/** Flux de lecture d'une photo. L'appelant a déjà vérifié le droit d'accès. */
export async function lirePhoto(chemin: string) {
  if (!stockagePhotosConfigure()) return null;
  try {
    return await get(chemin, { access: "private" });
  } catch {
    return null;
  }
}
