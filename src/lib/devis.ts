// Pipeline commercial (générateur de devis) : transitions serveur, comme
// src/lib/workflow.ts pour le RDV. Le prix d'un devis est calculé une seule
// fois à la création (grille PackTarif + options, jamais transmis par le
// client) et reste figé jusqu'à conversion en RDV.
import type { Devis } from "@/lib/types";
import { photosInitiales } from "@/lib/types";
import { db, genToken, historiserDevis, premierEvenement, versDevis } from "@/lib/db";

export type ResultatDevis = { ok: true } | { ok: false; error: string };

async function enregistrer(devis: Devis) {
  await db.devis.update({
    where: { id: devis.id },
    data: {
      statut: devis.statut,
      envoyeAt: devis.envoyeAt,
      consulteAt: devis.consulteAt,
      accepteAt: devis.accepteAt,
      acomptePayeAt: devis.acomptePayeAt,
      rendezVousId: devis.rendezVousId,
    },
  });
}

export async function trouverDevis(id: string) {
  const ligne = await db.devis.findUnique({ where: { id } });
  return ligne ? versDevis(ligne) : null;
}

export async function devisParToken(token: string) {
  const ligne = await db.devis.findUnique({ where: { token } });
  return ligne ? versDevis(ligne) : null;
}

export async function envoyerDevis(devis: Devis): Promise<ResultatDevis> {
  if (devis.statut !== "BROUILLON") return { ok: false, error: "Le devis a déjà été envoyé." };
  devis.statut = "ENVOYE";
  devis.envoyeAt = new Date();
  await enregistrer(devis);
  await historiserDevis(devis, "Devis envoyé au client (SMS/e-mail simulé).");
  return { ok: true };
}

export async function marquerDevisConsulte(devis: Devis) {
  if (devis.statut === "ENVOYE") {
    devis.statut = "CONSULTE";
    devis.consulteAt = new Date();
    await enregistrer(devis);
    await historiserDevis(devis, "Devis consulté par le client.");
  }
}

export async function accepterDevis(devis: Devis): Promise<ResultatDevis> {
  if (devis.statut !== "ENVOYE" && devis.statut !== "CONSULTE") {
    return { ok: false, error: "Ce devis ne peut plus être accepté." };
  }
  devis.statut = "ACCEPTE";
  devis.accepteAt = new Date();
  await enregistrer(devis);
  await historiserDevis(devis, "Devis accepté par le client.");
  return { ok: true };
}

function diviserNom(nomComplet: string): { prenom: string; nom: string } {
  const parts = nomComplet.trim().split(/\s+/);
  if (parts.length === 1) return { prenom: parts[0], nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

// Conversion devis → RDV : crée les fiches Client/Adresse/Véhicule à partir
// des informations du prospect, puis un RendezVous avec le prix figé au
// moment du devis, le tout dans une transaction. L'opérateur est ensuite
// choisi via le moteur d'affectation, comme pour tout autre RDV.
export async function convertirDevisEnRdv(devis: Devis, dateHeure: Date): Promise<{ ok: true; rendezVousId: string } | { ok: false; error: string }> {
  if (devis.statut !== "ACOMPTE_PAYE") {
    return { ok: false, error: "L'acompte doit être payé avant de créer le rendez-vous." };
  }
  if (Number.isNaN(dateHeure.getTime())) return { ok: false, error: "Date invalide." };

   const { prenom, nom } = diviserNom(devis.nomClient);
    const rendezVousId = await db.$transaction(async (tx) => {
      const pack = await tx.pack.findUniqueOrThrow({ where: { id: devis.packId } });
      const options = await tx.option.findMany({ where: { id: { in: devis.optionIds } } });
      const client = await tx.client.create({
        data: {
          prenom,
          nom,
          telephone: devis.telephoneClient,
          email: devis.emailClient,
          adresses: { create: { libelle: devis.raisonSociale, adresse: devis.adresse, ville: devis.ville } },
          vehicules: { create: { categorie: devis.categorieVehicule, marque: devis.vehiculeDescription || null } },
        },
        include: { adresses: true, vehicules: true },
      });
      const rdv = await tx.rendezVous.create({
        data: {
          clientId: client.id,
          vehiculeId: client.vehicules[0].id,
          adresseId: client.adresses[0].id,
          packId: devis.packId,
          categorieVehicule: devis.categorieVehicule,
          dateHeure,
          dureeMinutes: pack.dureeMinMinutes,
          prixTotal: devis.prixTotal,
          acompte: devis.acompte,
          source: "DEVIS",
          notes: `Converti depuis le devis ${devis.id} (acompte déjà payé).`,
          suiviToken: genToken(),
          photosAvant: photosInitiales(),
          photosApres: photosInitiales(),
          historique: premierEvenement("Rendez-vous créé depuis le devis accepté (acompte déjà payé)."),
          options: { create: options.map((o) => ({ optionId: o.id, prixUnitaire: o.prix })) },
        },
      });
      devis.statut = "RDV_CREE";
      devis.rendezVousId = rdv.id;
      await tx.devis.update({ where: { id: devis.id }, data: { statut: "RDV_CREE", rendezVousId: rdv.id } });
      await historiserDevis(devis, "Rendez-vous créé — prêt pour affectation d'un opérateur.", tx);
      return rdv.id;
    });

    return { ok: true, rendezVousId };
}

