// Prestations proposées à la réservation en ligne (page d'accueil). Les
// prix et les options viennent TOUJOURS de la grille du back-office
// (Packs & Tarifs) : ce fichier ne fait que les présenter.
import { listerOptionsActives, listerPacksAvecTarifs } from "@/lib/queries";
import { plageDureeLisible } from "@/lib/heure";

export type PrestationPublique = {
  packId: string;
  titre: string;
  accroche: string;
  description: string | null;
  duree: string;
  tarifs: { categorie: string; prix: number }[];
};

export type OptionPublique = {
  id: string;
  nom: string;
  prix: number;
  groupe: string | null;
  unite: string | null;
  quantiteMax: number;
};

const PRESENTATION: Record<string, { titre: string; accroche: string }> = {
  "pack-concession": {
    titre: "Lavage intérieur",
    accroche: "Sièges, moquettes, surfaces : l'habitacle comme au premier jour.",
  },
  "pack-concession-luxe": {
    titre: "Lavage intérieur + extérieur",
    accroche: "L'habitacle et la carrosserie, lavés à la main jusqu'à la finition.",
  },
};
const ORDRE_CATEGORIES = ["CITADINE", "BERLINE", "SUV", "MONOSPACE", "UTILITAIRE"];

export function titrePrestation(packId: string, nomPack: string) {
  return PRESENTATION[packId]?.titre ?? nomPack;
}

export async function prestationsPubliques(): Promise<PrestationPublique[]> {
  return (await listerPacksAvecTarifs())
    .filter((p) => p.tarifs.length > 0)
    .map((p) => {
      const presentation = PRESENTATION[p.id];
      return {
        packId: p.id,
        titre: titrePrestation(p.id, p.nom),
        accroche: presentation?.accroche ?? p.description ?? "",
        description: p.description,
        duree: plageDureeLisible(p.dureeMinMinutes, p.dureeMaxMinutes),
        tarifs: [...p.tarifs]
          .sort((a, b) => ORDRE_CATEGORIES.indexOf(a.categorie) - ORDRE_CATEGORIES.indexOf(b.categorie))
          .map((t) => ({ categorie: t.categorie, prix: t.prix })),
      };
    });
}

export async function optionsPubliques(): Promise<OptionPublique[]> {
  return (await listerOptionsActives()).map((o) => ({
      id: o.id,
      nom: o.nom,
      prix: o.prix,
      groupe: o.groupe ?? null,
      unite: o.unite ?? null,
      quantiteMax: o.quantiteMax ?? 1,
    }));
}

