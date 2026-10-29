import { NextResponse } from "next/server";
import { db, genToken, premierEvenement } from "@/lib/db";
import { devisAvecRelations } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { calculerPrix } from "@/lib/rendezVous";
import { CATEGORIES_VEHICULE } from "@/lib/clients";
import { journaliser } from "@/lib/audit";
import { envoyerDevis, trouverDevis } from "@/lib/devis";

// Création d'un devis par le commercial ou le directeur. Le prix n'est
// jamais reçu du client : il est recalculé côté serveur depuis la grille
// PackTarif + options, exactement comme pour un RDV.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role === "OPERATEUR" || session.role === "COMPTABLE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "corps invalide" }, { status: 400 });

  for (const champ of ["typeClient", "nomClient", "telephoneClient", "adresse", "ville", "categorieVehicule", "packId"]) {
    if (!body[champ]) return NextResponse.json({ error: `${champ} requis` }, { status: 400 });
  }
  if (body.typeClient !== "PARTICULIER" && body.typeClient !== "PRO") {
    return NextResponse.json({ error: "typeClient invalide" }, { status: 400 });
  }
  if (!CATEGORIES_VEHICULE.includes(body.categorieVehicule)) {
    return NextResponse.json({ error: "catégorie de véhicule invalide" }, { status: 400 });
  }

  const optionIds: string[] = Array.isArray(body.optionIds) ? body.optionIds.filter((id: unknown) => typeof id === "string") : [];
  const prix = await calculerPrix(body.packId, body.categorieVehicule, optionIds);
  if (!prix.ok) return NextResponse.json({ error: prix.erreur }, { status: 400 });

  /*
   * Remise, frais de route et acompte sont recalculés ici et jamais repris du
   * formulaire : le prix total envoyé par un navigateur n'engage personne.
   * La remise ne porte que sur les prestations — les frais de déplacement sont
   * un coût, pas une marge sur laquelle négocier.
   */
  const remisePourcent = Math.min(100, Math.max(0, Number(body.remisePourcent) || 0));
  const fraisDeplacement = Math.max(0, Number(body.fraisDeplacement) || 0);
  const avecAcompte = body.avecAcompte !== false;

  const arrondi = (v: number) => Math.round(v * 100) / 100;
  const base = prix.valeur.prixTotal;
  const prixTotal = arrondi(base * (1 - remisePourcent / 100) + fraisDeplacement);
  const acompte = avecAcompte ? arrondi(prixTotal * 0.1) : 0;

  const devis = await db.devis.create({
    data: {
      token: genToken(),
      typeClient: body.typeClient,
      nomClient: String(body.nomClient),
      telephoneClient: String(body.telephoneClient),
      emailClient: body.emailClient || null,
      raisonSociale: body.typeClient === "PRO" ? body.raisonSociale || null : null,
      adresse: String(body.adresse),
      ville: String(body.ville),
      vehiculeDescription: body.vehiculeDescription || "",
      categorieVehicule: body.categorieVehicule,
      packId: body.packId,
      optionIds,
      remisePourcent,
      fraisDeplacement,
      avecAcompte,
      prixTotal,
      acompte,
      creeParUtilisateurId: session.sub,
      historique: premierEvenement("Devis créé."),
    },
  });
  await journaliser({ acteur: session, action: "DEVIS_CREE", entite: "Devis", entiteId: devis.id, details: { base, remisePourcent, fraisDeplacement, prixTotal, acompte } });

  /*
   * Envoi immédiat quand la direction le demande. L'échec n'annule pas le
   * devis — il est créé, chiffré, consultable — mais il est dit : « envoyé »
   * sans destinataire joignable est ce qui fait perdre une affaire sans le
   * savoir.
   */
  let envoi: { envoye: boolean; erreur?: string } | null = null;
  if (body.envoyer === true) {
    const complet = await trouverDevis(devis.id);
    if (complet) {
      const resultat = await envoyerDevis(complet);
      envoi = resultat.ok ? resultat.envoi : { envoye: false, erreur: resultat.error };
      if (resultat.ok) {
        await journaliser({ acteur: session, action: "DEVIS_ENVOYE", entite: "Devis", entiteId: devis.id });
      }
    }
  }

    return NextResponse.json({ ...(await devisAvecRelations(devis.id)), envoi }, { status: 201 });
}

