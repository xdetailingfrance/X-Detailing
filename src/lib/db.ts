// Accès à la base PostgreSQL (Prisma) et conversions vers les types métier
// (src/lib/types.ts) : montants Decimal → nombres, champs JSON typés.
import { randomBytes } from "node:crypto";
import { PrismaClient, Prisma } from "@/generated/prisma/client";
import type * as Db from "@/generated/prisma/client";
import { adaptateurPg, table } from "@/lib/connexion";
import type { Devis, EvenementHistorique, PhotoPrestation, RendezVous, SansDecimal } from "@/lib/types";

export type Tx = Prisma.TransactionClient;

const globalDb = globalThis as unknown as { xdDb?: PrismaClient };

function client(): PrismaClient {
  if (!globalDb.xdDb) {
    globalDb.xdDb = new PrismaClient({ adapter: adaptateurPg() });
  }
  return globalDb.xdDb;
}

// Client créé à la première requête (et non à l'import), pour que le build
// et les pages statiques n'exigent pas la base.
export const db = new Proxy({} as PrismaClient, {
  get(_, propriete) {
    const instance = client();
    const valeur = Reflect.get(instance, propriete, instance);
    return typeof valeur === "function" ? valeur.bind(instance) : valeur;
  },
});

// Jeton public non devinable (suivi client, devis) — jamais l'id interne.
export function genToken(): string {
  return randomBytes(18).toString("base64url");
}

export function sansDecimal<T>(valeur: T): SansDecimal<T> {
  if (Prisma.Decimal.isDecimal(valeur)) return (valeur as Prisma.Decimal).toNumber() as SansDecimal<T>;
  if (valeur === null || typeof valeur !== "object" || valeur instanceof Date) return valeur as SansDecimal<T>;
  if (Array.isArray(valeur)) return valeur.map(sansDecimal) as SansDecimal<T>;
  return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, sansDecimal(v)])) as SansDecimal<T>;
}

function lireHistorique(json: Prisma.JsonValue): EvenementHistorique[] {
  if (!Array.isArray(json)) return [];
  return json.map((e) => {
    const evt = e as { horodatage: string; libelle: string };
    return { horodatage: new Date(evt.horodatage), libelle: evt.libelle };
  });
}

function lirePhotos(json: Prisma.JsonValue): PhotoPrestation[] {
  if (!Array.isArray(json)) return [];
  return json.map((p) => {
    const photo = p as {
      angle: PhotoPrestation["angle"];
      prise: boolean;
      prisAt: string | null;
      chemin?: string | null;
    };
    return {
      angle: photo.angle,
      prise: photo.prise,
      prisAt: photo.prisAt ? new Date(photo.prisAt) : null,
      // Absent sur les prestations antérieures à la prise de vue réelle.
      chemin: photo.chemin ?? null,
    };
  });
}

type AvecJsonRdv<T> = Omit<SansDecimal<T>, "historique" | "photosAvant" | "photosApres"> & {
  historique: EvenementHistorique[];
  photosAvant: PhotoPrestation[];
  photosApres: PhotoPrestation[];
};

export function versRdv<T extends Db.RendezVous>(ligne: T): AvecJsonRdv<T> {
  return {
    ...sansDecimal(ligne),
    historique: lireHistorique(ligne.historique),
    photosAvant: lirePhotos(ligne.photosAvant),
    photosApres: lirePhotos(ligne.photosApres),
  } as AvecJsonRdv<T>;
}

type AvecJsonDevis<T> = Omit<SansDecimal<T>, "historique"> & { historique: EvenementHistorique[] };

export function versDevis<T extends Db.Devis>(ligne: T): AvecJsonDevis<T> {
  return { ...sansDecimal(ligne), historique: lireHistorique(ligne.historique) } as AvecJsonDevis<T>;
}

export class ConflitDeVersion extends Error {
  constructor() {
    super("Le rendez-vous a été modifié en même temps par quelqu'un d'autre. Rechargez la page et recommencez.");
  }
}

// Champs du RDV enregistrés par enregistrerRdv. L'historique n'en fait pas
// partie : il ne s'écrit que par ajout (historiserRdv), jamais réécrit.
const CHAMPS_RDV = [
  "clientId",
  "vehiculeId",
  "adresseId",
  "packId",
  "categorieVehicule",
  "secteurId",
  "operateurId",
  "dateHeure",
  "dureeMinutes",
  "prixTotal",
  "acompte",
  "fraisDeplacement",
  "distanceKm",
  "statut",
  "source",
  "notes",
  "suiviToken",
  "routeDemarreeAt",
  "signatureControleDataUrl",
  "signatureControleAt",
  "photosAvant",
  "lavageDemarreAt",
  "photosApres",
  "signatureFinDataUrl",
  "signatureFinAt",
  "modePaiement",
  "lienPaiementEnvoyeAt",
  "paiementConfirmeAt",
  "numeroFacture",
  "noteClient",
  "noteClientAt",
  "acompteStatut",
  "stripeSessionId",
] as const satisfies readonly (keyof RendezVous)[];

// Enregistre les modifications d'un RDV chargé en mémoire, avec un verrou
// optimiste : si le RDV a changé entre-temps (autre utilisateur, webhook),
// rien n'est écrasé et ConflitDeVersion est levée.
export async function enregistrerRdv(rdv: RendezVous, tx: Tx = db) {
  const data = Object.fromEntries(CHAMPS_RDV.map((champ) => [champ, rdv[champ]])) as Record<string, unknown>;
  data.photosAvant = rdv.photosAvant as unknown as Prisma.InputJsonValue;
  data.photosApres = rdv.photosApres as unknown as Prisma.InputJsonValue;
  const resultat = await tx.rendezVous.updateMany({
    where: { id: rdv.id, version: rdv.version },
    data: { ...(data as Prisma.RendezVousUncheckedUpdateManyInput), version: { increment: 1 } },
  });
  if (resultat.count === 0) throw new ConflitDeVersion();
  rdv.version += 1;
  rdv.updatedAt = new Date();
}

// Ajout atomique au journal d'un RDV (jamais de réécriture de l'historique).
export async function historiserRdv(rdv: Pick<RendezVous, "id" | "historique">, libelle: string, tx: Tx = db) {
  const evenement = { horodatage: new Date(), libelle };
  rdv.historique.push(evenement);
  await tx.$executeRaw`UPDATE ${Prisma.raw(table("RendezVous"))} SET historique = historique || ${JSON.stringify([evenement])}::jsonb, "updatedAt" = now() WHERE id = ${rdv.id}`;
}

export async function historiserDevis(devis: Pick<Devis, "id" | "historique">, libelle: string, tx: Tx = db) {
  const evenement = { horodatage: new Date(), libelle };
  devis.historique.push(evenement);
  await tx.$executeRaw`UPDATE ${Prisma.raw(table("Devis"))} SET historique = historique || ${JSON.stringify([evenement])}::jsonb, "updatedAt" = now() WHERE id = ${devis.id}`;
}

export function premierEvenement(libelle: string): Prisma.InputJsonValue {
  return [{ horodatage: new Date().toISOString(), libelle }];
}

