// Actions sur les rendez-vous partagées entre les routes du back-office,
// la réservation en ligne et l'assistante Lola : mêmes règles de prix,
// d'affectation et de SMS automatiques, quel que soit le point d'entrée.
import type { RendezVous, SourceRendezVous, StatutRendezVous, Sms } from "@/lib/types";
import { photosInitiales } from "@/lib/types";
import { db, enregistrerRdv, genToken, historiserRdv, premierEvenement, versRdv, type Tx } from "@/lib/db";
import { MODELES_SMS, smsAOperateur, smsAuClient } from "@/lib/sms";
import { formatParis } from "@/lib/heure";

export const TAUX_ACOMPTE = 0.1; // acompte de 10 % à la réservation

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: string };

// Calcul du prix côté serveur, JAMAIS reçu du client : grille PackTarif
// (prestation + catégorie du véhicule) + options. Une option facturée à
// l'unité (ex. par siège) apparaît dans optionIds autant de fois que la
// quantité choisie.
export async function calculerPrix(
  packId: string,
  categorie: RendezVous["categorieVehicule"],
  optionIds: string[],
  tx: Tx = db
): Promise<Resultat<{ prixTotal: number; acompte: number; lignes: { optionId: string; prixUnitaire: number; quantite: number }[]; dureeMinMinutes: number }>> {
  const pack = await tx.pack.findUnique({ where: { id: packId }, include: { tarifs: true } });
  if (!pack) return { ok: false, erreur: "pack inconnu" };
  const tarif = pack.tarifs.find((t) => t.categorie === categorie);
  if (!tarif) {
    return {
      ok: false,
      erreur: `Tarif non paramétré pour le pack "${pack.nom}" et la catégorie ${categorie}. À renseigner dans Packs & tarifs.`,
    };
  }

  const quantites = new Map<string, number>();
  for (const id of optionIds) quantites.set(id, (quantites.get(id) ?? 0) + 1);
  const options = await tx.option.findMany({ where: { id: { in: [...quantites.keys()] }, actif: true } });
  if (options.length !== quantites.size) return { ok: false, erreur: "une ou plusieurs options sont invalides" };
  const lignes = options.map((o) => ({ optionId: o.id, prixUnitaire: o.prix.toNumber(), quantite: quantites.get(o.id)! }));
  for (const ligne of lignes) {
    const max = options.find((o) => o.id === ligne.optionId)?.quantiteMax ?? 1;
    if (ligne.quantite > max) return { ok: false, erreur: "quantité d'option invalide" };
  }

  const prixTotal = Math.round((tarif.prix.toNumber() + lignes.reduce((t, l) => t + l.prixUnitaire * l.quantite,0)) * 100) / 100;
  const acompte = Math.round(prixTotal * TAUX_ACOMPTE * 100) / 100;
  return { ok: true, valeur: { prixTotal, acompte, lignes, dureeMinMinutes: pack.dureeMinMinutes } };
}

// Crée le RDV sans opérateur (EN_ATTENTE), prix recalculé côté serveur.
export async function creerRendezVous(
  donnees: {
    clientId: string;
    vehiculeId: string;
    adresseId: string;
    packId: string;
    dateHeure: Date;
    optionIds?: string[];
    secteurId?: string | null;
    dureeMinutes?: number | null;
    source?: SourceRendezVous;
    notes?: string | null;
    libelle?: string;
  },
  tx: Tx = db
): Promise<Resultat<RendezVous>> {
  if (Number.isNaN(donnees.dateHeure.getTime())) return { ok: false, erreur: "date invalide" };

    const vehicule = await tx.vehicule.findUnique({ where: { id: donnees.vehiculeId } });
    if (!vehicule || vehicule.clientId !== donnees.clientId) return { ok: false, erreur: "véhicule inconnu" };
    const adresse = await tx.adresse.findUnique({ where: { id: donnees.adresseId } });
    if (!adresse || adresse.clientId !== donnees.clientId) return { ok: false, erreur: "adresse inconnue" };

    const prix = await calculerPrix(donnees.packId, vehicule.categorie, donnees.optionIds ?? [], tx);
    if (!prix.ok) return prix;

    const ligne = await tx.rendezVous.create({
      data: {
        clientId: donnees.clientId,
        vehiculeId: donnees.vehiculeId,
        adresseId: donnees.adresseId,
        packId: donnees.packId,
        categorieVehicule: vehicule.categorie,
        secteurId: donnees.secteurId ?? null,
        dateHeure: donnees.dateHeure,
        dureeMinutes: donnees.dureeMinutes ?? prix.valeur.dureeMinMinutes,
        prixTotal: prix.valeur.prixTotal,
        acompte: prix.valeur.acompte,
        source: donnees.source ?? "TELEPHONE",
        notes: donnees.notes ?? null,
        suiviToken: genToken(),
        photosAvant: photosInitiales(),
        photosApres: photosInitiales(),
        historique: premierEvenement(donnees.libelle ?? "Rendez-vous créé."),
        options: { create: prix.valeur.lignes },
      },
    });
    return { ok: true, valeur: versRdv(ligne) };
}

// RDV de l'opérateur qui chevauchent le créneau donné (trajets non
// compris : le moteur d'affectation reste la référence pour la faisabilité).
export async function conflitsOperateur(operateurId: string, debut: Date, dureeMinutes: number, sauf?: string) {
  const fin = new Date(debut.getTime() + dureeMinutes * 60000);
  const candidats = await db.rendezVous.findMany({
    where: {
      operateurId,
      statut: { not: "ANNULE" },
      id: sauf ? { not: sauf } : undefined,
      dateHeure: { lt: fin, gte: new Date(debut.getTime() - 24 * 3600000) },
    },
  });
  return candidats.map(versRdv).filter((r) => r.dateHeure.getTime() + r.dureeMinutes * 60000 > debut.getTime());
}

async function nomOperateur(operateurId: string) {
  const o = await db.operateur.findUnique({ where: { id: operateurId } });
  return o ? `${o.prenom} ${o.nom}`.replace(/\.$/, "") : operateurId;
}

// Affecte un opérateur (validation humaine : proposé par le moteur ou
// choisi manuellement). Ne fait rien si c'est déjà lui. Enregistre le RDV.
export async function appliquerAffectation(rdv: RendezVous, operateurId: string) {
  const changement = rdv.operateurId !== operateurId;
  rdv.operateurId = operateurId;
  await enregistrerRdv(rdv);
  await db.affectationCandidat.updateMany({ where: { rendezVousId: rdv.id }, data: { retenu: false } });
  await db.affectationCandidat.updateMany({ where: { rendezVousId: rdv.id, operateurId }, data: { retenu: true }});
  if (changement) await historiserRdv(rdv, `Affecté à ${await nomOperateur(operateurId)}.`);
  return changement;
}

// SMS automatiques d'une affectation : l'opérateur reçoit le détail de la
// mission, le client le prénom de son opérateur.
export async function notifierAffectation(rdv: RendezVous, envoyePar: string) {
  const sms: Sms[] = [];
  const operateur = await smsAOperateur(rdv, await MODELES_SMS.affectationOperateur(rdv), "AFFECTATION_OPERATEUR", envoyePar);
  if (operateur) sms.push(operateur);
  const client = await smsAuClient(rdv, await MODELES_SMS.affectationClient(rdv), "AFFECTATION_OPERATEUR", envoyePar);
  if (client) sms.push(client);
  return sms;
}

export async function trouverRendezVous(id: string, tx: Tx = db) {
    const ligne = await tx.rendezVous.findUnique({ where: { id } });
    return ligne ? versRdv(ligne) : null;
}

// Change le statut et enregistre le RDV.
export async function changerStatut(rdv: RendezVous, statut: StatutRendezVous, tx: Tx = db) {
  if (rdv.statut === statut) return;
  rdv.statut = statut;
  await enregistrerRdv(rdv, tx);
  const libelles: Partial<Record<StatutRendezVous, string>> = {
    ANNULE: "Rendez-vous annulé.",
    CONFIRME: "Rendez-vous confirmé.",
    EN_ATTENTE: "Rendez-vous remis en attente.",
  };
  await historiserRdv(rdv, libelles[statut] ?? `Statut : ${statut}.`, tx);
}

// Déplace le RDV et l'enregistre.
export async function deplacerRendezVous(rdv: RendezVous, dateHeure: Date) {
  const avant = rdv.dateHeure;
  rdv.dateHeure = dateHeure;
  await enregistrerRdv(rdv);
  const court = (d: Date) => formatParis(d, { dateStyle: "short", timeStyle: "short" });
  await historiserRdv(rdv, `Déplacé du ${court(avant)} au ${court(dateHeure)}.`);
}

// Une facture émise ou un encaissement font du rendez-vous une pièce
// comptable : elle se conserve (et se rembourse), elle ne s'efface pas.
// Reste l'annulation, qui garde la ligne et libère le créneau.
export function suppressionDefinitivePossible(
  rdv: Pick<RendezVous, "numeroFacture" | "acompteStatut" | "paiementConfirmeAt">
) {
  return !rdv.numeroFacture && rdv.acompteStatut !== "PAYE" && !rdv.paiementConfirmeAt;
}
