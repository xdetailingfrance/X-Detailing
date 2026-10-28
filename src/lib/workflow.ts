// Moteur de transitions du workflow verrouillé opérateur (arrivée → contrôle
// signé → photos avant → lavage → photos après → signature de fin →
// paiement → clôture). Toute la logique GPS/photos/signature/SMS est
// SIMULÉE côté client (voir composants dans src/app/operateur et
// src/app/suivi) : ce module ne fait que valider et appliquer les
// transitions d'état côté serveur, seule source de vérité pour le statut
// d'un rendez-vous — jamais un statut envoyé "tel quel" par le client.
import type { AnglePhoto, ModePaiement, RendezVous } from "@/lib/types";
import { db, enregistrerRdv, historiserRdv, versRdv } from "@/lib/db";
import { composantesParis } from "@/lib/heure";

export type ActionWorkflow =
  | { type: "DEMARRER_ROUTE" }
  | { type: "CONFIRMER_ARRIVEE" }
  | { type: "SIGNATURE_CONTROLE"; dataUrl: string }
  | { type: "PASSER_PHOTOS_AVANT" }
  | { type: "PHOTO_AVANT"; angle: AnglePhoto; chemin?: string }
  | { type: "PASSER_LAVAGE" }
  | { type: "TERMINER_LAVAGE" }
  | { type: "PHOTO_APRES"; angle: AnglePhoto; chemin?: string }
  | { type: "SIGNATURE_FIN"; dataUrl: string }
  | { type: "PASSER_PAIEMENT" }
  | { type: "CHOISIR_MODE_PAIEMENT"; mode: ModePaiement }
  | { type: "ENVOYER_LIEN_PAIEMENT" }
  | { type: "CONFIRMER_PAIEMENT" };

export type ResultatWorkflow = { ok: true } | { ok: false; error: string };

function genererNumeroFacture(rdv: RendezVous): string {
  const annee = composantesParis(new Date()).annee;
  return `XD-${annee}-${rdv.id.slice(-6).toUpperCase()}`;
}

// Applique l'action au RDV puis l'enregistre (verrou optimiste) et ajoute
// les événements à son historique. Rejette toute action dont la
// précondition d'état n'est pas respectée, pour ne jamais faire confiance
// à l'ordre envoyé par le client.
export async function appliquerActionWorkflow(rdv: RendezVous, action: ActionWorkflow): Promise<ResultatWorkflow>{
  const evenements: string[] = [];
  const resultat = transition(rdv, action, (libelle) => evenements.push(libelle));
  if (!resultat.ok) return resultat;
  await enregistrerRdv(rdv);
  for (const libelle of evenements) await historiserRdv(rdv, libelle);
  return resultat;
}

function transition(rdv: RendezVous, action: ActionWorkflow, historiser: (libelle: string) => void): ResultatWorkflow {
  switch (action.type) {
    case "DEMARRER_ROUTE": {
      if (rdv.statut !== "CONFIRME") return { ok: false, error: "Le RDV doit être confirmé avant de démarrer la route." };
      rdv.statut = "EN_ROUTE";
      rdv.routeDemarreeAt = new Date();
      historiser("Route démarrée (GPS live activé).");
      return { ok: true };
    }

      case "CONFIRMER_ARRIVEE": {
        if (rdv.statut !== "EN_ROUTE") return { ok: false, error: "L'opérateur n'est pas en route." };
        rdv.statut = "CONTROLE";
        historiser("Arrivée confirmée sur place — contrôle du véhicule et du prix.");
        return { ok: true };
      }

      case "SIGNATURE_CONTROLE": {
        if (rdv.statut !== "CONTROLE") return { ok: false, error: "Étape de contrôle non active." };
        if (!action.dataUrl) return { ok: false, error: "Signature manquante." };
        rdv.signatureControleDataUrl = action.dataUrl;
        rdv.signatureControleAt = new Date();
        historiser("Signature client — accord sur véhicule/catégorie/prix.");
        return { ok: true };
      }

    case "PASSER_PHOTOS_AVANT": {
      if (rdv.statut !== "CONTROLE") return { ok: false, error: "Étape de contrôle non active." };
      if (!rdv.signatureControleDataUrl) return { ok: false, error: "Signature de contrôle requise avant de continuer." };
      rdv.statut = "PHOTOS_AVANT";
      historiser("Passage aux photos avant prestation.");
      return { ok: true };
    }

      case "PHOTO_AVANT": {
        if (rdv.statut !== "PHOTOS_AVANT") return { ok: false, error: "Étape photos avant non active." };
        const photo = rdv.photosAvant.find((p) => p.angle === action.angle);
        if (!photo) return { ok: false, error: "Angle inconnu." };
        photo.prise = true;
        photo.prisAt = new Date();
        photo.chemin = action.chemin ?? null;
        historiser(`Photo avant prise (${action.angle}).`);
        return { ok: true };
      }

    case "PASSER_LAVAGE": {
      if (rdv.statut !== "PHOTOS_AVANT") return { ok: false, error: "Étape photos avant non active." };
      if (!rdv.photosAvant.every((p) => p.prise)) return { ok: false, error: "Les 4 photos avant sont obligatoires." };
      rdv.statut = "LAVAGE";
      rdv.lavageDemarreAt = new Date();
      historiser("Prestation démarrée.");
      return { ok: true };
    }

      case "TERMINER_LAVAGE": {
        if (rdv.statut !== "LAVAGE") return { ok: false, error: "La prestation n'est pas en cours." };
        rdv.statut = "PHOTOS_APRES";
        historiser("Prestation terminée — passage aux photos après.");
        return { ok: true };
      }

      case "PHOTO_APRES": {
        if (rdv.statut !== "PHOTOS_APRES") return { ok: false, error: "Étape photos après non active." };
        const photo = rdv.photosApres.find((p) => p.angle === action.angle);
        if (!photo) return { ok: false, error: "Angle inconnu." };
        photo.prise = true;
        photo.prisAt = new Date();
        photo.chemin = action.chemin ?? null;
        historiser(`Photo après prise (${action.angle}).`);
        return { ok: true };
      }

    case "SIGNATURE_FIN": {
      if (rdv.statut !== "PHOTOS_APRES") return { ok: false, error: "Étape photos après non active." };
      if (!rdv.photosApres.every((p) => p.prise)) return { ok: false, error: "Les 4 photos après sont obligatoires." };
      if (!action.dataUrl) return { ok: false, error: "Signature manquante." };
      rdv.signatureFinDataUrl = action.dataUrl;
      rdv.signatureFinAt = new Date();
      historiser("Signature client — fin de prestation.");
      return { ok: true };
    }

      case "PASSER_PAIEMENT": {
        if (rdv.statut !== "PHOTOS_APRES") return { ok: false, error: "Étape photos après non active." };
        if (!rdv.signatureFinDataUrl) return { ok: false, error: "Signature de fin requise avant de continuer." };
        rdv.statut = "PAIEMENT";
        historiser("Passage au paiement.");
        return { ok: true };
      }

      case "CHOISIR_MODE_PAIEMENT": {
        if (rdv.statut !== "PAIEMENT") return { ok: false, error: "Étape de paiement non active." };
        rdv.modePaiement = action.mode;
        historiser(`Mode de paiement choisi : ${action.mode === "CARTE" ? "carte (lien à distance)" : "espèces"}.`);
            return { ok: true };
        }

    case "ENVOYER_LIEN_PAIEMENT": {
      if (rdv.statut !== "PAIEMENT") return { ok: false, error: "Étape de paiement non active." };
      if (rdv.modePaiement !== "CARTE") return { ok: false, error: "Le lien de paiement n'est envoyé qu'en mode carte." };
      rdv.lienPaiementEnvoyeAt = new Date();
      historiser("Lien de paiement envoyé par SMS (simulé) au client.");
      return { ok: true };
    }

        case "CONFIRMER_PAIEMENT": {
          if (rdv.statut !== "PAIEMENT") return { ok: false, error: "Étape de paiement non active." };
          if (!rdv.modePaiement) return { ok: false, error: "Choisir un mode de paiement." };
          if (rdv.modePaiement === "CARTE" && !rdv.lienPaiementEnvoyeAt) {
            return { ok: false, error: "Envoyer le lien de paiement avant de confirmer." };
          }
          rdv.paiementConfirmeAt = new Date();
          rdv.numeroFacture = genererNumeroFacture(rdv);
          rdv.statut = "TERMINE";
          historiser(`Paiement confirmé — facture ${rdv.numeroFacture} — dossier clôturé.`);
          return { ok: true };
        }

        default:
          return { ok: false, error: "Action inconnue." };
    }
}

export async function rendezVousParToken(token: string) {
  const ligne = await db.rendezVous.findUnique({ where: { suiviToken: token } });
  return ligne ? versRdv(ligne) : null;
}

