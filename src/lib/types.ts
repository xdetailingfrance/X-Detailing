// Types métier de l'application, dérivés du schéma Prisma
// (prisma/schema.prisma) : mêmes champs que les tables, montants convertis
// en nombres (euros) et champs JSON typés.
import type * as Db from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

export type {
  CategorieVehicule,
  StatutOperateur,
  StatutRendezVous,
  SourceRendezVous,
  RoleUtilisateur,
  ModePaiement,
  StatutAcompte,
  StatutDevis,
  TypeClientDevis,
  MotifSms,
  StatutSms,
} from "@/generated/prisma/client";

// Remplace récursivement les Decimal Prisma par des nombres.
export type SansDecimal<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? T
    : T extends Array<infer U>
      ? SansDecimal<U>[]
      : T extends object
        ? { [K in keyof T]: SansDecimal<T[K]> }
        : T;

export type AnglePhoto = "AVANT" | "ARRIERE" | "COTE_GAUCHE" | "COTE_DROIT";
export const ANGLES_PHOTO: AnglePhoto[] = ["AVANT", "ARRIERE", "COTE_GAUCHE", "COTE_DROIT"];
export const LIBELLE_ANGLE_PHOTO: Record<AnglePhoto, string> = {
  AVANT: "Avant",
  ARRIERE: "Arrière",
  COTE_GAUCHE: "Côté gauche",
  COTE_DROIT: "Côté droit",
};

export type PhotoPrestation = {
  angle: AnglePhoto;
  prise: boolean;
  prisAt: Date | null;
};

export function photosInitiales(): PhotoPrestation[] {
  return ANGLES_PHOTO.map((angle) => ({ angle, prise: false, prisAt: null }));
}

export type EvenementHistorique = {
  horodatage: Date;
  libelle: string;
};

export type Utilisateur = Db.Utilisateur;
export type Secteur = Db.Secteur;
export type Client = Db.Client;
export type Adresse = Db.Adresse;
export type Vehicule = Db.Vehicule;
export type Operateur = Db.Operateur;
export type Pack = Db.Pack;
export type PackTarif = SansDecimal<Db.PackTarif>;
export type Option = SansDecimal<Db.Option>;
export type RendezVousOption = SansDecimal<Db.RendezVousOption>;
export type AffectationCandidat = Db.AffectationCandidat;
export type DepensesMensuelles = SansDecimal<Db.DepensesMensuelles>;
export type Sms = Db.Sms;

export type RendezVous = Omit<SansDecimal<Db.RendezVous>, "historique" | "photosAvant" | "photosApres"> & {
  historique: EvenementHistorique[];
  photosAvant: PhotoPrestation[];
  photosApres: PhotoPrestation[];
};

export type Devis = Omit<SansDecimal<Db.Devis>, "historique"> & {
  historique: EvenementHistorique[];
};

