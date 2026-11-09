/**
 * Attribution automatique d'un rendez-vous à l'opérateur qui couvre la zone.
 *
 * Le principe : un rendez-vous n'attend pas qu'un humain décide à qui il
 * revient. Chaque secteur porte un périmètre (un centre, un rayon) ; le
 * rendez-vous tombe dans celui qui le contient, et part à l'opérateur qui y
 * exerce — sans l'aval de personne.
 *
 * Tant qu'aucun secteur n'a de périmètre et qu'un seul opérateur est actif,
 * tout lui revient : c'est la situation d'aujourd'hui, et elle ne demande
 * aucun réglage. Le jour où un opérateur couvre Toulouse, il suffit de
 * renseigner son périmètre pour que les rendez-vous toulousains lui aillent
 * directement.
 */
import { db, type Tx } from "@/lib/db";
import type { RendezVous } from "@/lib/types";
import { haversineKm } from "@/lib/geo";
import { assurerGeocodage } from "@/lib/clients";
import { appliquerAffectation, notifierAffectation } from "@/lib/rendezVous";
import { evaluerCandidats } from "@/lib/affectation";
import { journaliser } from "@/lib/audit";

export type Attribution =
  | { attribue: true; operateurId: string; motif: "perimetre" | "unique" | "meilleur" }
  | { attribue: false; motif: "aucun-operateur" | "hors-perimetre" | "adresse-inconnue" | "aucun-disponible" };

/** Opérateurs actifs dont le secteur couvre ce point. */
export async function operateursCouvrant(latitude: number, longitude: number, tx: Tx = db) {
  const operateurs = await tx.operateur.findMany({
    where: { statut: "ACTIF", secteur: { isNot: null } },
    include: { secteur: true },
  });
  return operateurs.filter((o) => {
    const s = o.secteur;
    if (!s || s.latitude == null || s.longitude == null || s.rayonKm == null) return false;
    return haversineKm(s.latitude, s.longitude, latitude, longitude) <= s.rayonKm;
  });
}

/**
 * Attribue le rendez-vous et prévient qui de droit. Idempotent : un
 * rendez-vous déjà affecté n'est pas réattribué.
 */
export async function attribuerAutomatiquement(rdv: RendezVous): Promise<Attribution> {
  if (rdv.operateurId) return { attribue: true, operateurId: rdv.operateurId, motif: "perimetre" };

  const actifs = await db.operateur.count({ where: { statut: "ACTIF" } });
  if (actifs === 0) return { attribue: false, motif: "aucun-operateur" };

  const point = await assurerGeocodage(rdv.adresseId);
  let choisi: string | null = null;
  let motif: "perimetre" | "unique" | "meilleur" = "perimetre";

  if (point) {
    const couvrants = await operateursCouvrant(point.latitude, point.longitude);
    if (couvrants.length === 1) {
      choisi = couvrants[0].id;
    } else if (couvrants.length > 1) {
      // Plusieurs opérateurs couvrent la zone : on départage par le moteur
      // de tournée, pas au hasard.
      const candidats = await evaluerCandidats({
        latitude: point.latitude,
        longitude: point.longitude,
        dateHeure: rdv.dateHeure,
        dureeMinutes: rdv.dureeMinutes,
        excludeRendezVousId: rdv.id,
      });
      const retenu = candidats.find((c) => couvrants.some((o) => o.id === c.operateurId));
      if (!retenu) return { attribue: false, motif: "aucun-disponible" };
      choisi = retenu.operateurId;
      motif = "meilleur";
    }
  }

  // Aucun périmètre ne correspond — ou l'adresse n'est pas géocodée. Avec un
  // seul opérateur actif, la question ne se pose pas : tout est pour lui.
  if (!choisi) {
    if (actifs > 1) return { attribue: false, motif: point ? "hors-perimetre" : "adresse-inconnue" };
    const seul = await db.operateur.findFirstOrThrow({ where: { statut: "ACTIF" } });
    choisi = seul.id;
    motif = "unique";
  }

  await appliquerAffectation(rdv, choisi);
  await journaliser({
    acteur: "systeme",
    action: "RDV_ATTRIBUE_AUTOMATIQUEMENT",
    entite: "RendezVous",
    entiteId: rdv.id,
    details: { operateurId: choisi, motif },
  });
  await notifierAffectation(rdv, "automatique");
  return { attribue: true, operateurId: choisi, motif };
}
