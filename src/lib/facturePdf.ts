/**
 * La facture en PDF, jointe à l'e-mail de fin de prestation.
 *
 * Le client reçoit ainsi un document qu'il garde sans rien avoir à faire —
 * la page imprimable reste disponible pour qui préfère l'écran.
 *
 * Le dessin est forcément distinct du rendu HTML, mais les CHIFFRES ne le
 * sont pas : lignes, règlement et ventilation de TVA viennent des mêmes
 * fonctions que la page et que le back-office. Une facture papier qui ne
 * tomberait pas sur le même total que sa version écran serait indéfendable.
 *
 * pdf-lib plutôt qu'un navigateur sans interface : pas de binaire à
 * installer, pas de police à charger, et cela tourne tel quel en serverless.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { Facture } from "@/lib/facturation";
import { lignesFacture, reglement } from "@/lib/facturation";
import { ENTREPRISE, adresseComplete, ventilerTva } from "@/lib/entreprise";
import { dureeLisible, formatParis } from "@/lib/heure";

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 48;
const NOIR = rgb(0.1, 0.1, 0.12);
const GRIS = rgb(0.42, 0.42, 0.47);
const TRAIT = rgb(0.82, 0.82, 0.85);

const euros = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export function nomFichierFacture(facture: Facture) {
  return `Facture-${(facture.numeroFacture ?? "X-Detailing").replace(/[^\w-]/g, "")}.pdf`;
}

export async function genererFacturePdf(facture: Facture): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${facture.numeroFacture ?? ""} — ${ENTREPRISE.raisonSociale}`);
  doc.setProducer(ENTREPRISE.raisonSociale);
  const page = doc.addPage([A4.largeur, A4.hauteur]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = A4.hauteur - MARGE;
  const ecrire = (texte: string, options: { x?: number; taille?: number; police?: PDFFont; couleur?: typeof NOIR; droite?: number } = {}) => {
    const taille = options.taille ?? 9.5;
    const police = options.police ?? normal;
    const x = options.droite != null ? options.droite - police.widthOfTextAtSize(texte, taille) : (options.x ?? MARGE);
    page.drawText(texte, { x, y, size: taille, font: police, color: options.couleur ?? NOIR });
  };
  const ligneHorizontale = (epaisseur = 0.7) => {
    page.drawLine({
      start: { x: MARGE, y },
      end: { x: A4.largeur - MARGE, y },
      thickness: epaisseur,
      color: TRAIT,
    });
  };

  // En-tête : l'émetteur à gauche, la facture à droite.
  ecrire(ENTREPRISE.raisonSociale, { taille: 15, police: gras });
  ecrire("FACTURE", { taille: 9, couleur: GRIS, droite: A4.largeur - MARGE });
  y -= 16;
  ecrire(facture.numeroFacture ?? "", { taille: 13, police: gras, droite: A4.largeur - MARGE });

  const identite = [
    `${ENTREPRISE.formeJuridique}${ENTREPRISE.capital ? ` au capital de ${ENTREPRISE.capital}` : ""}`,
    adresseComplete(),
    `SIRET ${ENTREPRISE.siret} · ${ENTREPRISE.rcs} ${ENTREPRISE.siren}`,
    `TVA ${ENTREPRISE.tva} · NAF ${ENTREPRISE.naf.code}`,
    [ENTREPRISE.email, ENTREPRISE.telephone].filter(Boolean).join(" · "),
  ];
  for (const ligne of identite) {
    ecrire(ligne, { taille: 8, couleur: GRIS });
    y -= 11;
  }
  y += 11;
  const emiseLe = facture.paiementConfirmeAt ?? facture.dateHeure;
  ecrire(`Émise le ${formatParis(emiseLe, { dateStyle: "long" })}`, { taille: 8, couleur: GRIS, droite: A4.largeur - MARGE });

  // Client et prestation, côte à côte.
  y -= 38;
  const colonneDroite = A4.largeur / 2 + 10;
  ecrire("CLIENT", { taille: 7.5, couleur: GRIS });
  ecrire("PRESTATION", { x: colonneDroite, taille: 7.5, couleur: GRIS });
  y -= 14;

  const vehicule =
    [facture.vehicule.marque, facture.vehicule.modele].filter(Boolean).join(" ") ||
    facture.categorieVehicule.toLowerCase();
  const gauche = [
    `${facture.client.prenom} ${facture.client.nom}`,
    facture.adresse.adresse,
    `${facture.adresse.codePostal ?? ""} ${facture.adresse.ville}`.trim(),
    facture.client.telephone,
  ].filter(Boolean);
  const droite = [
    formatParis(facture.dateHeure, { dateStyle: "long", timeStyle: "short" }),
    `Durée ${dureeLisible(facture.dureeMinutes)}`,
    `Véhicule : ${vehicule}${facture.vehicule.immatriculation ? ` (${facture.vehicule.immatriculation})` : ""}`,
    facture.operateur ? `Réalisée par ${facture.operateur.prenom} ${facture.operateur.nom}` : "",
  ].filter(Boolean);

  const hauteurBloc = Math.max(gauche.length, droite.length);
  const yBloc = y;
  for (const [i, ligne] of gauche.entries()) {
    y = yBloc - i * 12;
    ecrire(ligne);
  }
  for (const [i, ligne] of droite.entries()) {
    y = yBloc - i * 12;
    ecrire(ligne, { x: colonneDroite });
  }
  y = yBloc - hauteurBloc * 12;

  // Le détail facturé.
  y -= 22;
  ligneHorizontale(0.9);
  y -= 13;
  const colQte = A4.largeur - MARGE - 200;
  const colPu = A4.largeur - MARGE - 110;
  const colTotal = A4.largeur - MARGE;
  ecrire("DÉSIGNATION", { taille: 7.5, couleur: GRIS });
  ecrire("QTÉ", { taille: 7.5, couleur: GRIS, droite: colQte });
  ecrire("P.U.", { taille: 7.5, couleur: GRIS, droite: colPu });
  ecrire("TOTAL", { taille: 7.5, couleur: GRIS, droite: colTotal });
  y -= 8;
  ligneHorizontale();

  for (const l of lignesFacture(facture)) {
    y -= 16;
    ecrire(l.libelle);
    ecrire(String(l.quantite), { droite: colQte });
    ecrire(euros(l.prixUnitaire), { droite: colPu });
    ecrire(euros(l.total), { droite: colTotal });
    y -= 6;
    ligneHorizontale(0.4);
  }

  // Totaux, alignés à droite.
  const tva = ventilerTva(facture.prixTotal);
  const regle = reglement(facture);
  y -= 22;
  const totaux: [string, string, boolean][] = [];
  if (tva?.assujetti) {
    totaux.push(["Total HT", euros(tva.ht), false]);
    totaux.push([`TVA ${Math.round(tva.taux * 100)} %`, euros(tva.tva), false]);
  }
  totaux.push([`Total${tva?.assujetti ? " TTC" : ""}`, euros(facture.prixTotal), true]);
  if (regle.acompte > 0) {
    totaux.push(["Acompte déjà réglé", `- ${euros(regle.acompte)}`, false]);
    totaux.push(["Solde réglé à la prestation", euros(regle.solde), false]);
  }
  for (const [libelle, montant, fort] of totaux) {
    ecrire(libelle, { droite: colTotal - 90, couleur: fort ? NOIR : GRIS, police: fort ? gras : normal });
    ecrire(montant, { droite: colTotal, police: fort ? gras : normal });
    y -= 15;
  }

  // Mentions de pied de page.
  y -= 14;
  ligneHorizontale();
  y -= 14;
  const pied = [
    tva ? (tva.assujetti ? "" : tva.mention) : "Régime de TVA non renseigné : la mention obligatoire manque sur cette facture.",
    `Réglée par ${regle.mode === "CARTE" ? "carte bancaire" : regle.mode === "ESPECES" ? "espèces" : "moyen non précisé"}${
      facture.paiementConfirmeAt ? ` le ${formatParis(facture.paiementConfirmeAt, { dateStyle: "long" })}` : ""
    }. Facture acquittée, aucun solde restant dû.`,
    "En cas de retard de paiement, pénalités au taux d'intérêt légal majoré et indemnité forfaitaire de",
    "recouvrement de 40 € (articles L. 441-10 et D. 441-5 du code de commerce).",
  ].filter(Boolean);
  for (const ligne of pied) {
    ecrire(ligne, { taille: 7.5, couleur: GRIS });
    y -= 10;
  }

  return doc.save();
}
