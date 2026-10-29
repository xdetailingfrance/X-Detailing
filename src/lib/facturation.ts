/**
 * Factures émises.
 *
 * Une facture n'est pas une table à part : c'est un rendez-vous clôturé et
 * payé, à qui le workflow a attribué un numéro unique. Dupliquer les lignes
 * dans un second modèle les ferait diverger au premier changement de prix —
 * et une facture qui ne dit pas la même chose que le dossier qu'elle
 * facture ne vaut rien.
 */
import { db, sansDecimal } from "@/lib/db";
import { ENTREPRISE } from "@/lib/entreprise";

const INCLUDE_FACTURE = {
  client: true,
  vehicule: true,
  adresse: true,
  pack: true,
  operateur: true,
  options: { include: { option: true } },
} as const;

/** Factures émises, de la plus récente à la plus ancienne. */
export async function listerFactures(limite = 200) {
  return sansDecimal(
    await db.rendezVous.findMany({
      where: { numeroFacture: { not: null } },
      include: INCLUDE_FACTURE,
      orderBy: { paiementConfirmeAt: "desc" },
      take: limite,
    })
  );
}

export async function factureParId(id: string) {
  const ligne = await db.rendezVous.findUnique({ where: { id }, include: INCLUDE_FACTURE });
  if (!ligne || !ligne.numeroFacture) return null;
  return sansDecimal(ligne);
}

export type Facture = NonNullable<Awaited<ReturnType<typeof factureParId>>>;

export type LigneFacture = { libelle: string; quantite: number; prixUnitaire: number; total: number };

/**
 * Le détail facturé, reconstruit depuis le dossier : la prestation au tarif
 * figé à la réservation, chaque option avec sa quantité, et le déplacement.
 * La somme des lignes vaut le total — c'est vérifié par un test.
 */
export function lignesFacture(facture: Facture): LigneFacture[] {
  const options = facture.options.map((o) => ({
    libelle: o.option.nom,
    quantite: o.quantite,
    prixUnitaire: o.prixUnitaire,
    total: Math.round(o.prixUnitaire * o.quantite * 100) / 100,
  }));
  const totalOptions = options.reduce((s, l) => s + l.total, 0);
  // Le tarif de la prestation n'est pas stocké seul : c'est ce qui reste du
  // total une fois retirés les options et le déplacement.
  const prestation = Math.round((facture.prixTotal - totalOptions - facture.fraisDeplacement) * 100) / 100;

  const lignes: LigneFacture[] = [
    { libelle: `${facture.pack.nom} — ${facture.categorieVehicule.toLowerCase()}`, quantite: 1, prixUnitaire: prestation, total: prestation },
    ...options,
  ];
  if (facture.fraisDeplacement > 0) {
    const distance = facture.distanceKm != null ? ` (${Math.round(facture.distanceKm)} km)` : "";
    lignes.push({
      libelle: `Déplacement depuis ${ENTREPRISE.adresse.ville}${distance}`,
      quantite: 1,
      prixUnitaire: facture.fraisDeplacement,
      total: facture.fraisDeplacement,
    });
  }
  return lignes;
}

/** Ce qui a déjà été encaissé, et ce qui restait dû à la clôture. */
export function reglement(facture: Facture) {
  const acompte = facture.acompteStatut === "PAYE" ? facture.acompte : 0;
  return {
    acompte,
    solde: Math.round((facture.prixTotal - acompte) * 100) / 100,
    mode: facture.modePaiement,
  };
}

export type EtatEnvoi = { envoye: boolean; erreur?: string; quand: Date } | null;

/**
 * Dernier envoi d'e-mail connu pour chaque facture, lu au journal d'audit.
 *
 * Rien n'est stocké sur le rendez-vous pour ça : le journal enregistre déjà
 * chaque tentative (EMAIL_FACTURE / EMAIL_FACTURE_ECHEC) et il est la seule
 * source qui ne se réécrit pas. Sans cette lecture, une facture jamais
 * reçue ressemblerait à une facture envoyée.
 */
export async function etatEnvoiFactures(rendezVousIds: string[]): Promise<Map<string, EtatEnvoi>> {
  const etats = new Map<string, EtatEnvoi>(rendezVousIds.map((id) => [id, null]));
  if (rendezVousIds.length === 0) return etats;

  const entrees = await db.journalAudit.findMany({
    where: { entite: "RendezVous", entiteId: { in: rendezVousIds }, action: { in: ["EMAIL_FACTURE", "EMAIL_FACTURE_ECHEC"] } },
    orderBy: { createdAt: "asc" },
    select: { entiteId: true, action: true, details: true, createdAt: true },
  });
  // Parcours chronologique : la dernière tentative écrase les précédentes.
  for (const e of entrees) {
    if (!e.entiteId) continue;
    const details = (e.details ?? {}) as { erreur?: string };
    etats.set(e.entiteId, {
      envoye: e.action === "EMAIL_FACTURE",
      erreur: details.erreur,
      quand: e.createdAt,
    });
  }
  return etats;
}
