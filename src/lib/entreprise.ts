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

  // Non publiés au registre : à renseigner par la direction.
  capital: null as string | null,
  email: null as string | null,
  assuranceRcPro: null as { assureur: string; contrat: string } | null,
  mediateur: null as { nom: string; coordonnees: string } | null,
} as const;

export function adresseComplete() {
  const { ligne, codePostal, ville } = ENTREPRISE.adresse;
  return `${ligne}, ${codePostal} ${ville}`;
}

/** Ce qui manque encore pour que les mentions légales soient complètes. */
export function mentionsManquantes(): string[] {
  const manquantes: string[] = [];
  if (!ENTREPRISE.capital) manquantes.push("capital social");
  if (!ENTREPRISE.email) manquantes.push("adresse e-mail de contact");
  if (!ENTREPRISE.assuranceRcPro) manquantes.push("assurance responsabilité civile professionnelle");
  if (!ENTREPRISE.mediateur) manquantes.push("médiateur de la consommation");
  return manquantes;
}
