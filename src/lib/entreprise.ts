/**
 * Identité légale de l'entreprise — source unique.
 *
 * Reprise du registre du commerce : conditions générales, factures et devis
 * lisent ces valeurs, jamais une copie. Une facture qui porte un SIRET
 * différent de celui des conditions générales est une facture contestable.
 *
 * Les champs à null ne figurent pas au registre public. Ils s'affichent comme
 * manquants plutôt que d'être inventés : une mention légale fabriquée est pire
 * qu'une mention absente, parce qu'elle a l'air vraie.
 */
export const ENTREPRISE = {
  raisonSociale: "X DETAILING",
  formeJuridique: "Société par actions simplifiée (SAS)",
  siren: "131212250",
  siret: "13121225000016",
  tva: "FR92131212250",
  rcs: "RCS BORDEAUX",
  naf: { code: "45.20A", libelle: "Entretien et réparation de véhicules automobiles légers" },
  immatriculationLe: "01/10/2026",
  adresse: {
    ligne: "Chemin de Brondeau Parc de Citon B03",
    codePostal: "33370",
    ville: "Pompignac",
  },
  telephone: "+33 6 49 36 83 28",
  /** Au format attendu par wa.me : international, sans espace ni « + ». */
  whatsapp: "33649368328",

  // Non publiés au registre : renseignés par la direction.
  capital: "1 000 €" as string | null,
  email: "contact@xdetailing.fr" as string | null,

  /**
   * Régime de TVA, qui décide de ce que porte une facture : un taux et une
   * ventilation HT/TVA/TTC, ou la mention « TVA non applicable, art. 293 B
   * du CGI ». null tant que la direction ne l'a pas tranché — une facture
   * qui annonce un taux faux est une facture à refaire, et l'oubli de la
   * mention en franchise l'est tout autant. Rien n'est deviné depuis le
   * numéro de TVA : en avoir un ne signifie pas facturer la TVA.
   */
  regimeTva: null as { type: "FRANCHISE" } | { type: "ASSUJETTI"; taux: number } | null,
} as const;

export type VentilationTva =
  | { assujetti: false; mention: string }
  | { assujetti: true; taux: number; ht: number; tva: number; ttc: number };

/**
 * Ventile un montant TTC selon le régime, ou null si le régime n'est pas
 * renseigné — l'appelant doit alors le dire plutôt que d'afficher un total
 * sans mention de TVA.
 */
export function ventilerTva(montantTtc: number): VentilationTva | null {
  const regime = ENTREPRISE.regimeTva;
  if (!regime) return null;
  if (regime.type === "FRANCHISE") {
    return { assujetti: false, mention: "TVA non applicable, article 293 B du CGI" };
  }
  const ht = Math.round((montantTtc / (1 + regime.taux)) * 100) / 100;
  return {
    assujetti: true,
    taux: regime.taux,
    ht,
    tva: Math.round((montantTtc - ht) * 100) / 100,
    ttc: montantTtc,
  };
}

export function adresseComplete() {
  const { ligne, codePostal, ville } = ENTREPRISE.adresse;
  return `${ligne}, ${codePostal} ${ville}`;
}

/** Ce qui manque encore pour que les mentions légales soient complètes. */
export function mentionsManquantes(): string[] {
  const manquantes: string[] = [];
  if (!ENTREPRISE.capital) manquantes.push("capital social");
  if (!ENTREPRISE.email) manquantes.push("adresse e-mail de contact");
  if (!ENTREPRISE.regimeTva) manquantes.push("régime de TVA");
  return manquantes;
}
