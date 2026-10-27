// Indicateurs du tableau de bord du directeur, calculés sur les données
// réelles. Trois notions d'argent sont toujours distinguées :
// - réservé : prix des RDV non annulés de la période (prévisionnel) ;
// - réalisé : prix des prestations terminées (dossier clôturé, n° de facture) ;
// - encaissé vérifié : acomptes validés par Stripe ; les paiements de fin de
//   prestation sont « déclarés » par l'opérateur tant qu'aucun prestataire
//   ne les confirme.
// Aucune estimation n'est présentée comme un montant comptable.
import type { Prisma } from "@/generated/prisma/client";
import type { SourceRendezVous } from "@/lib/types";
import { db, sansDecimal } from "@/lib/db";
import {
  composantesParis,
  dateParis,
  debutJourParis,
  debutMoisParis,
  debutSemaineParis,
  decalerJour,
  finJourParis,
  formatParis,
  jourParis,
  moisParis,
} from "@/lib/heure";

export type Periode = "jour" | "semaine" | "mois" | "annee" | "personnalisee";

export type Filtres = {
  periode: Periode;
  du?: string; // YYYY-MM-DD, période personnalisée
  au?: string;
  operateurId?: string;
  packId?: string;
  source?: SourceRendezVous;
};

export const SOURCES: { valeur: SourceRendezVous; libelle: string }[] = [
  { valeur: "SITE_CLIENT", libelle: "Site internet" },
  { valeur: "TELEPHONE", libelle: "Téléphone" },
  { valeur: "LEAD_META", libelle: "Lead Meta" },
  { valeur: "DEVIS", libelle: "Devis" },
  { valeur: "LAVER_MAINTENANT", libelle: "Laver maintenant" },
];

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Bornes [debut, fin[ de la période, en heure de Paris.
export function bornesPeriode(f: Filtres, maintenant = new Date()) {
  if (f.periode === "personnalisee" && f.du && f.au && JOUR.test(f.du) && JOUR.test(f.au) && f.du <= f.au) {
    return { debut: dateParis(f.du), fin: dateParis(decalerJour(f.au, 1)) };
  }
  if (f.periode === "jour") return { debut: debutJourParis(maintenant), fin: finJourParis(maintenant) };
  if (f.periode === "semaine") {
    const debut = debutSemaineParis(maintenant);
    return { debut, fin: dateParis(decalerJour(jourParis(debut), 7)) };
  }
  if (f.periode === "annee") {
    const a = composantesParis(maintenant).annee;
    return { debut: dateParis(`${a}-01-01`), fin: dateParis(`${a + 1}-01-01`) };
  }
  const debut = debutMoisParis(maintenant);
  const c = composantesParis(maintenant);
  const suivant = c.mois === 12 ? `${c.annee + 1}-01-01` : `${c.annee}-${String(c.mois + 1).padStart(2, "0")}-01`;
  return { debut, fin: dateParis(suivant) };
}

function filtreRdv(f: Filtres): Prisma.RendezVousWhereInput {
  return {
    operateurId: f.operateurId || undefined,
    packId: f.packId || undefined,
    source: f.source || undefined,
  };
}

const somme = (valeurs: number[]) => Math.round(valeurs.reduce((t, v) => t + v, 0) * 100) / 100;

export async function indicateurs(f: Filtres) {
  const { debut, fin } = bornesPeriode(f);
  const maintenant = new Date();
  const filtre = filtreRdv(f);

   const rdvs = sansDecimal(
     await db.rendezVous.findMany({
       where: { ...filtre, dateHeure: { gte: debut, lt: fin }, statut: { not: "ANNULE" } },
       select: {
         statut: true,
         prixTotal: true,
         acompte: true,
         acompteStatut: true,
         modePaiement: true,
         paiementConfirmeAt: true,
         operateurId: true,
         dateHeure: true,
       },
     })
   );
   const termines = rdvs.filter((r) => r.statut === "TERMINE");
   const acompteVerifie = (r: (typeof rdvs)[number]) => (r.acompteStatut === "PAYE" ? r.acompte : 0);
   const declares = termines.filter((r) => r.paiementConfirmeAt);
   const declareParMode = (mode: "CARTE" | "ESPECES") =>
     declares.filter((r) => r.modePaiement === mode).map((r) => r.prixTotal - acompteVerifie(r));

  const caReserve = somme(rdvs.map((r) => r.prixTotal));
  const caRealise = somme(termines.map((r) => r.prixTotal));
  const encaisseVerifie = somme(rdvs.map(acompteVerifie));
  const declareEspeces = somme(declareParMode("ESPECES"));
  const declareCarte = somme(declareParMode("CARTE"));
  const resteARecevoir = somme([caRealise, -somme(termines.map(acompteVerifie)), -declareEspeces, -declareCarte]);

  const [rdvJour, aVenir, enAttente, operateursActifs, devisEnvoyes, devisConvertis, depenses] = await Promise.all([
    db.rendezVous.count({ where: { ...filtre, statut: { not: "ANNULE" }, dateHeure: { gte: debutJourParis(maintenant), lt: finJourParis(maintenant) } } }),
    db.rendezVous.count({ where: { ...filtre, statut: { in: ["EN_ATTENTE", "CONFIRME"] }, dateHeure: { gte: maintenant } } }),
    db.rendezVous.count({ where: { ...filtre, statut: "EN_ATTENTE", operateurId: null, dateHeure: { gte: maintenant } } }),
    db.operateur.count({ where: { statut: "ACTIF" } }),
    db.devis.count({ where: { envoyeAt: { gte: debut, lt: fin }, packId: f.packId || undefined } }),
    db.devis.count({ where: { envoyeAt: { gte: debut, lt: fin }, statut: "RDV_CREE", packId: f.packId || undefined } }),
    db.depensesMensuelles.findUnique({ where: { mois: moisParis(maintenant) } }),
  ]);

   const depensesMois = depenses ? depenses.depenses.toNumber() : 0;
   const publiciteMois = depenses ? depenses.publicite.toNumber() : 0;

  return {
    periode: { debut, fin, libelle: libellePeriode(f, debut, fin) },
    caReserve,
    caRealise,
    encaisseVerifie,
    declareEspeces,
    declareCarte,
    resteARecevoir,
    nbReservations: rdvs.length,
    nbTermines: termines.length,
    rdvJour,
    aVenir,
    enAttente,
    operateursActifs,
    devisEnvoyes,
    tauxTransformation: devisEnvoyes ? Math.round((devisConvertis / devisEnvoyes) * 100) : null,
    depensesMois,
    publiciteMois,
    // Coût publicitaire par réservation : budget saisi du mois ÷ réservations
    // du mois (toutes sources) — estimation tant que Meta n'est pas connecté.
    coutPubParReservation: f.periode === "mois" && rdvs.length && publiciteMois ? Math.round((publiciteMois / rdvs.length) * 100) / 100 : null,
  };
}

function libellePeriode(f: Filtres, debut: Date, fin: Date) {
  if (f.periode === "jour") return `aujourd'hui, ${formatParis(debut, { day: "numeric", month: "long" })}`;
  if (f.periode === "semaine") return `semaine du ${formatParis(debut, { day: "numeric", month: "long" })}`;
  if (f.periode === "mois") return formatParis(debut, { month: "long", year: "numeric" });
  if (f.periode === "annee") return `année ${composantesParis(debut).annee}`;
  const dernier = new Date(fin.getTime() - 12 * 3600000);
  return `du ${formatParis(debut, { dateStyle: "short" })} au ${formatParis(dernier, { dateStyle: "short" })}`;
}

export type Granularite = "semaine" | "mois" | "annee";

// Série « réservé » et « réalisé » par semaine (12), mois (12) ou année (5).
export async function serieCA(granularite: Granularite, f: Filtres) {
  const maintenant = new Date();
  const c = composantesParis(maintenant);
  const intervalles: { libelle: string; debut: Date; fin: Date }[] = [];
  if (granularite === "semaine") {
    const lundi = jourParis(debutSemaineParis(maintenant));
    for (let i = 11; i >= 0; i--) {
      const j = decalerJour(lundi, -7 * i);
      intervalles.push({ libelle: formatParis(dateParis(j, "12:00"), { day: "numeric", month: "short" }), debut:dateParis(j), fin: dateParis(decalerJour(j, 7)) });
    }
  } else if (granularite === "mois") {
    for (let i = 11; i >= 0; i--) {
      const index = c.annee * 12 + (c.mois - 1) - i;
      const a = Math.floor(index / 12);
      const m = (index % 12) + 1;
      const suivant = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
      const debut = dateParis(`${a}-${String(m).padStart(2, "0")}-01`);
      intervalles.push({ libelle: formatParis(debut, { month: "short", year: "2-digit" }), debut, fin: dateParis(suivant) });
    }
  } else {
    for (let a = c.annee - 4; a <= c.annee; a++) {
      intervalles.push({ libelle: String(a), debut: dateParis(`${a}-01-01`), fin: dateParis(`${a + 1}-01-01`) });
    }
  }

  const rdvs = sansDecimal(
    await db.rendezVous.findMany({
      where: { ...filtreRdv(f), statut: { not: "ANNULE" }, dateHeure: { gte: intervalles[0].debut, lt: intervalles[intervalles.length - 1].fin } },
      select: { dateHeure: true, prixTotal: true, statut: true },
    })
  );
  return intervalles.map((iv) => {
    const dedans = rdvs.filter((r) => r.dateHeure >= iv.debut && r.dateHeure < iv.fin);
    return {
      libelle: iv.libelle,
      reserve: somme(dedans.map((r) => r.prixTotal)),
      realise: somme(dedans.filter((r) => r.statut === "TERMINE").map((r) => r.prixTotal)),
    };
  });
}

