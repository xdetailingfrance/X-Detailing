import { NextResponse } from "next/server";
import { ConflitDeVersion, db } from "@/lib/db";
import { emailFacture, emailLienPaiement, emailOperateurEnRoute } from "@/lib/email";
import { rendezVousAvecRelations } from "@/lib/queries";
import { trouverRendezVous } from "@/lib/rendezVous";
import { getSession } from "@/lib/session";
import { appliquerActionWorkflow, type ActionWorkflow } from "@/lib/workflow";
import { creerSessionPaiementSolde, paiementEnLigneActif, soldeDu } from "@/lib/paiement";
import { MODELES_SMS, smsAuClient } from "@/lib/sms";

const ANGLES_VALIDES = ["AVANT", "ARRIERE", "COTE_GAUCHE", "COTE_DROIT"];
const MODES_VALIDES = ["CARTE", "ESPECES"];

// Pilotage du workflow verrouillé par l'opérateur assigné (ou le OWNER
// lorsqu'il agit comme opérateur n°1 — lancement solo). L'appartenance du
// RDV à l'appelant est revérifiée ici : le middleware n'autorise que le
// préfixe /api/operateur/ pour le rôle, jamais un RDV en particulier.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.operateurId) {
    return NextResponse.json({ error: "Non authentifié comme opérateur" }, { status: 401 });
  }

   const { id } = await params;
   const rdv = await trouverRendezVous(id);
   if (!rdv) {
     return NextResponse.json({ error: "introuvable" }, { status: 404 });
   }
   if (rdv.operateurId !== session.operateurId) {
     return NextResponse.json({ error: "Ce rendez-vous n'est pas affecté à votre compte." }, { status: 403 });
   }

   const body = await request.json().catch(() => null);
   if (!body || typeof body.type !== "string") {
     return NextResponse.json({ error: "action invalide" }, { status: 400 });
   }

   let action: ActionWorkflow;
   switch (body.type) {
     case "DEMARRER_ROUTE":
     case "CONFIRMER_ARRIVEE":
     case "PASSER_PHOTOS_AVANT":
     case "PASSER_LAVAGE":
     case "TERMINER_LAVAGE":
     case "PASSER_PAIEMENT":
     case "ENVOYER_LIEN_PAIEMENT":
     case "CONFIRMER_PAIEMENT":
       action = { type: body.type };
       break;
     case "SIGNATURE_CONTROLE":
     case "SIGNATURE_FIN":
       if (typeof body.dataUrl !== "string" || !body.dataUrl.startsWith("data:image/")) {
         return NextResponse.json({ error: "signature invalide" }, { status: 400 });
       }
       action = { type: body.type, dataUrl: body.dataUrl };
       break;
     case "PHOTO_AVANT":
     case "PHOTO_APRES":
       if (!ANGLES_VALIDES.includes(body.angle)) {
         return NextResponse.json({ error: "angle invalide" }, { status: 400 });
          }
          action = { type: body.type, angle: body.angle };
          break;
        case "CHOISIR_MODE_PAIEMENT":
          if (!MODES_VALIDES.includes(body.mode)) {
            return NextResponse.json({ error: "mode de paiement invalide" }, { status: 400 });
          }
          action = { type: body.type, mode: body.mode };
          break;
        default:
          return NextResponse.json({ error: "action inconnue" }, { status: 400 });
    }

    try {
      const resultat = await appliquerActionWorkflow(rdv, action);
      if (!resultat.ok) {
        return NextResponse.json({ error: resultat.error }, { status: 400 });
      }
      /*
       * La facture part à la clôture, et depuis la route plutôt que depuis le
       * workflow : celui-ci est une transition d'état pure, testée comme telle,
       * et un appel réseau dedans le rendrait lent et faillible. Un échec
       * d'envoi est consigné mais ne défait pas la clôture — le dossier est
       * terminé, la facture numérotée, et le client peut la redemander.
       */
      if (action.type === "CONFIRMER_PAIEMENT" && rdv.statut === "TERMINE") {
        await emailFacture(rdv);
      }
      // Départ de l'opérateur : le client est prévenu et reçoit le lien de
      // suivi au moment où il lui sert, et non des semaines plus tôt dans
      // l'e-mail de confirmation.
      if (action.type === "DEMARRER_ROUTE" && rdv.statut === "EN_ROUTE") {
        await emailOperateurEnRoute(rdv);
      }
      /*
       * Lien de paiement du solde : une vraie session Stripe, envoyée par SMS
       * et par e-mail. Le SMS parce que le client est là, son téléphone à la
       * main ; l'e-mail parce qu'un lien long se clique mal depuis un SMS et
       * qu'il reste retrouvable ensuite.
       *
       * L'échec est renvoyé à l'opérateur : lui dire que le lien est parti
       * alors qu'il ne l'est pas le ferait attendre un paiement qui
       * n'arrivera jamais.
       */
      if (action.type === "ENVOYER_LIEN_PAIEMENT" && rdv.lienPaiementEnvoyeAt) {
        if (!paiementEnLigneActif()) {
          return NextResponse.json(
            { error: "Le paiement en ligne n'est pas configuré : encaissez en espèces ou par votre terminal." },
            { status: 503 }
          );
        }
        const client = await db.client.findUnique({ where: { id: rdv.clientId } });
        const montant = soldeDu(rdv);
        try {
          const session = await creerSessionPaiementSolde(rdv, new URL(request.url).origin, client?.email ?? null);
          if (!session.url) throw new Error("Stripe n'a pas renvoyé de lien.");
          const sms = await smsAuClient(rdv, await MODELES_SMS.lienPaiement(rdv, session.url, montant), "MANUEL", "operateur");
          const courriel = await emailLienPaiement(rdv, session.url, montant);
          if (sms?.statut === "ECHEC" && !courriel.envoye) {
            return NextResponse.json(
              { error: `Le lien n'a pu être transmis ni par SMS ni par e-mail (${courriel.erreur ?? sms?.erreur}).` },
              { status: 502 }
            );
          }
        } catch (e) {
          console.error("Lien de paiement du solde impossible", e);
          return NextResponse.json(
            { error: "Le lien de paiement n'a pas pu être créé. Réessayez, ou encaissez autrement." },
            { status: 502 }
          );
        }
      }
    } catch (e) {
      if (e instanceof ConflitDeVersion) return NextResponse.json({ error: e.message }, { status: 409 });
      throw e;
    }

    return NextResponse.json(await rendezVousAvecRelations(rdv.id));
}

