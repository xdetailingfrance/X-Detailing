import { NextResponse } from "next/server";
import type { CategorieVehicule } from "@/lib/types";
import { db, historiserRdv } from "@/lib/db";
import { packAvecTarifs } from "@/lib/queries";
import { CATEGORIES_VEHICULE, chiffresTelephone, trouverOuCreerClient } from "@/lib/clients";
import { creerRendezVous } from "@/lib/rendezVous";
import { creneauxDisponibles, dateLocale } from "@/lib/disponibilites";
import { DISTANCE_MAX_TARIFEE, calculerDeplacement, geocoderDansLaZone } from "@/lib/deplacement";
import { emailConfirmationReservation } from "@/lib/email";
import { MODELES_SMS, smsAuClient } from "@/lib/sms";
import { titrePrestation } from "@/lib/prestationsPubliques";
import { libelleDateHeure } from "@/lib/heure";
import { journaliser } from "@/lib/audit";
import { creerSessionPaiement, libererReservation, libererReservationsExpirees, paiementEnLigneActif } from "@/lib/paiement";

const MAX_DEMANDES_EN_ATTENTE = 3;

function texte(valeur: unknown, max = 120) {
  return typeof valeur === "string" ? valeur.trim().slice(0, max) : "";
}

class Refus extends Error {
  constructor(
    message: string,
    readonly statut: number
  ) {
    super(message);
  }
}

// Réservation en ligne (parcours de la page d'accueil). Réutilise le
// système existant : fiche client (src/lib/clients.ts), RDV créé EN_ATTENTE
// avec prix et acompte recalculés côté serveur (src/lib/rendezVous.ts), SMS
// de confirmation (src/lib/sms.ts). Avec Stripe configuré, l'acompte est
// payé avant toute confirmation (src/lib/paiement.ts). L'opérateur est
// ensuite affecté depuis le back-office.
export async function POST(request: Request) {
   const body = await request.json().catch(() => null);
   if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

   // Champ piège invisible : rempli seulement par les robots.
   if (texte(body.site)) return NextResponse.json({ error: "Requête refusée" }, { status: 400 });

   const pack = await packAvecTarifs(texte(body.packId));
   if (!pack || !pack.actif) return NextResponse.json({ error: "Prestation inconnue" }, { status: 400 });

  const categorie = texte(body.categorie) as CategorieVehicule;
  if (!CATEGORIES_VEHICULE.includes(categorie) || !pack.tarifs.some((t) => t.categorie === categorie)) {
    return NextResponse.json({ error: "Catégorie de véhicule non proposée pour cette prestation" }, { status: 400});
  }

   // Une option à l'unité (ex. par siège) est répétée selon la quantité ;
   // validité et quantités sont vérifiées par le calcul du prix.
   const brutes: unknown[] = Array.isArray(body.optionIds) ? body.optionIds.slice(0, 50) : [];
   const optionIds = brutes.filter((id): id is string => typeof id === "string");

  await libererReservationsExpirees();
  const jour = texte(body.jour, 10);
  const heure = texte(body.heure, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !/^\d{2}:\d{2}$/.test(heure)) {
    return NextResponse.json({ error: "Ce créneau n'est plus disponible, choisissez-en un autre." }, { status: 409 });
  }

  const prenom = texte(body.prenom, 60);
  const nom = texte(body.nom, 60);
  const telephone = texte(body.telephone, 20);
  const adresse = texte(body.adresse, 160);
  const ville = texte(body.ville, 80);
  if (!prenom || !nom || !adresse || !ville || telephone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Merci de compléter vos coordonnées et l'adresse d'intervention." }, { status: 400 });
  }

  const chiffres = chiffresTelephone(telephone);
  const demandes = await db.rendezVous.findMany({
    where: { statut: "EN_ATTENTE", dateHeure: { gt: new Date() }, client: { telephone: { contains: chiffres.slice(-4) } } },
    include: { client: true },
  });
  if (demandes.filter((r) => chiffresTelephone(r.client.telephone) === chiffres).length >= MAX_DEMANDES_EN_ATTENTE) {
    return NextResponse.json(
      { error: "Vous avez déjà plusieurs réservations en attente. Nous vous recontactons très vite." },
      { status: 429 }
    );
  }

  // Supplément de route, recalculé ici à partir de l'adresse : le montant
  // affiché pendant la réservation n'est qu'un affichage, et un client ne
  // décide pas de ses propres frais de déplacement.
  //
  // Hors barème : on refuse plutôt que de facturer un déplacement gratuit à
  // l'autre bout du département. Géocodage ou itinéraire indisponible : on
  // laisse passer sans frais — un service tiers en panne ne doit pas bloquer
  // une réservation — et on l'inscrit à l'historique pour que le back-office
  // le voie.
  const codePostal = texte(body.codePostal, 10) || null;
  let fraisDeplacement = 0;
  let distanceKm: number | null = null;
  let noteDeplacement: string | null = null;
  const point = await geocoderDansLaZone(adresse, ville, codePostal);
  if (point) {
    const deplacement = await calculerDeplacement(point.latitude, point.longitude);
    if (deplacement.horsBareme) {
      return NextResponse.json(
        {
          error: `Votre adresse est à plus de ${DISTANCE_MAX_TARIFEE} km de notre point de départ : le déplacement fait l'objet d'un tarif particulier. Appelez-nous, nous vous faisons un devis.`,
        },
        { status: 422 }
      );
    }
    if (deplacement.distanceKm === null) {
      noteDeplacement = "Frais de déplacement non calculés : itinéraire indisponible à la réservation.";
    } else {
      distanceKm = deplacement.distanceKm;
      fraisDeplacement = deplacement.frais ?? 0;
    }
  } else {
    noteDeplacement = "Frais de déplacement non calculés : adresse non reconnue par la Base Adresse Nationale.";
  }

  // Vérification du créneau et création dans une même transaction, sous un
  // verrou par journée : deux clients ne peuvent pas prendre le même
  // créneau en même temps.
  let rdv;
  try {
    rdv = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reservation:${jour}`}))`;
        if (!(await creneauxDisponibles(jour, pack.dureeMinMinutes, tx)).includes(heure)) {
          throw new Refus("Ce créneau n'est plus disponible, choisissez-en un autre.", 409);
        }
        const { adresseId, vehiculeId } = await trouverOuCreerClient(
          {
            prenom,
            nom,
            telephone,
            email: texte(body.email, 120) || null,
            adresse: { adresse, ville, codePostal },
            vehicule: { categorie, marque: texte(body.marque, 40) || null, modele: texte(body.modele, 40) || null},
          },
          tx
        );
        const client = await tx.adresse.findUniqueOrThrow({ where: { id: adresseId }, select: { clientId: true }});
        const secteur = await tx.secteur.findFirst({ where: { ville: { equals: ville, mode: "insensitive" } } });
        const resultat = await creerRendezVous(
            {
            clientId: client.clientId,
            vehiculeId,
            adresseId,
            packId: pack.id,
            dateHeure: dateLocale(jour, heure),
            secteurId: secteur?.id ?? null,
            optionIds,
            fraisDeplacement,
            distanceKm,
            source: "SITE_CLIENT",
            notes: texte(body.precisions, 500) || null,
            libelle: "Réservé en ligne depuis la page d'accueil.",
          },
          tx
        );
        if (!resultat.ok) {
          const message = resultat.erreur.includes("option") ? "Une option n'est plus disponible, merci de revoirvotre sélection." : resultat.erreur;
          throw new Refus(message, 400);
        }
        return resultat.valeur;
      },
      { timeout: 15000 }
    );
  } catch (e) {
    if (e instanceof Refus) return NextResponse.json({ error: e.message }, { status: e.statut });
    throw e;
  }
  await journaliser({
    acteur: "client",
    action: "RESERVATION_EN_LIGNE",
    entite: "RendezVous",
    entiteId: rdv.id,
    details: { prixTotal: rdv.prixTotal, fraisDeplacement, distanceKm },
  });
  if (noteDeplacement) await historiserRdv(rdv, noteDeplacement);

  const lignesOptions = await db.rendezVousOption.findMany({ where: { rendezVousId: rdv.id }, include: { option:true } });
  const options = lignesOptions.map((l) => (l.quantite > 1 ? `${l.option.nom} × ${l.quantite}` : l.option.nom));
  const confirmation = {
    reference: rdv.id.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase(),
    prestation: titrePrestation(pack.id, pack.nom),
    options,
    categorie,
    quand: libelleDateHeure(rdv.dateHeure),
    adresse: `${adresse}, ${ville}`,
    prixTotal: rdv.prixTotal,
    acompte: rdv.acompte,
    fraisDeplacement: rdv.fraisDeplacement,
    distanceKm: rdv.distanceKm,
  };

   // Paiement Stripe : le RDV bloque le créneau et le client part payer
   // l'acompte. Rien n'est confirmé avant la validation de Stripe.
   if (paiementEnLigneActif()) {
     try {
       const session = await creerSessionPaiement({
         rdv,
         email: texte(body.email, 120) || null,
         origine: new URL(request.url).origin,
         metadonnees: {
           rdvId: rdv.id,
           reference: confirmation.reference,
           prestation: confirmation.prestation,
           options: options.join(" + "),
           quand: confirmation.quand,
           adresse: confirmation.adresse,
           prixTotal: String(rdv.prixTotal),
           acompte: String(rdv.acompte),
           prenom,
           packId: pack.id,
         },
       });
       return NextResponse.json({ paiement: { url: session.url } }, { status: 201 });
     } catch (e) {
       console.error("Stripe : création de la session de paiement impossible", e);
       await libererReservation(rdv.id, "Paiement indisponible (Stripe) : réservation annulée.");
       return NextResponse.json(
         { error: "Le paiement sécurisé est momentanément indisponible. Réessayez dans quelques minutes." },
         { status: 502 }
       );
     }
   }

   // Sans Stripe configuré : réservation enregistrée sans paiement en ligne.
   const sms = await smsAuClient(rdv, await MODELES_SMS.confirmationClient(rdv), "CONFIRMATION_RDV", "site");
   // L'e-mail double le SMS : il porte l'adresse, le détail du prix et le lien
   // de suivi, qu'un message de 160 caractères ne peut pas contenir. Son échec
   // n'empêche pas la réservation, déjà enregistrée.
   await emailConfirmationReservation(rdv);
  return NextResponse.json({ ...confirmation, paye: false, smsEnvoye: sms?.statut === "ENVOYE" }, { status: 201});
}

