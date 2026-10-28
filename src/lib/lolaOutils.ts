// Outils de Lola : ce qu'elle peut consulter et faire dans X Detailing
// (via l'API Claude, en tool use). Chaque outil applique les mêmes règles
// que le back-office (src/lib/rendezVous.ts, src/lib/clients.ts,
// src/lib/sms.ts) et les mêmes droits par rôle : un COMMERCIAL n'a ni les
// finances ni le CA des opérateurs.
import type Anthropic from "@anthropic-ai/sdk";
import type { StatutRendezVous } from "@/lib/types";
import { db, historiserRdv, sansDecimal, versRdv } from "@/lib/db";
import { dateParis, debutJourParis, debutMoisParis, debutSemaineParis, decalerJour, formatParis, libelleDateHeure, moisParis } from "@/lib/heure";
import type { SessionPayload } from "@/lib/auth";
import { listerOptionsActives, listerPacksAvecTarifs } from "@/lib/queries";
import { evaluerCandidats } from "@/lib/affectation";
import { CATEGORIES_VEHICULE, creerClient } from "@/lib/clients";
import {
  appliquerAffectation,
  changerStatut,
  conflitsOperateur,
  creerRendezVous,
  deplacerRendezVous,
  notifierAffectation,
  trouverRendezVous,
} from "@/lib/rendezVous";
import { convertirDevisEnRdv, trouverDevis } from "@/lib/devis";
import { journaliser } from "@/lib/audit";
import { MODELES_SMS, envoyerRappels, envoyerSms, smsAOperateur, smsAuClient, smsReelsActives } from "@/lib/sms";

const TAUX_COMMISSION = 0.18;

// Ce que Lola a fait pendant une réponse : RDV et SMS à montrer à l'écran,
// et si les données ont changé (rafraîchir le tableau de bord).
export type ContexteOutils = {
  session: SessionPayload;
  rdvTouches: Set<string>;
  smsEnvoyes: string[];
  modifie: boolean;
};

type Entree = Record<string, unknown>;

const OUTILS_LECTURE = [
  {
    name: "rechercher_clients",
    description:
      "Cherche des clients par prénom, nom ou téléphone (vide = les plus récents). Renvoie leurs adresses et véhicules avec leurs identifiants, nécessaires pour créer un rendez-vous.",
    input_schema: {
      type: "object",
      properties: { recherche: { type: "string", description: "Texte à chercher ; chaîne vide pour lister." } },
      required: ["recherche"],
    },
  },
  {
    name: "lister_rendez_vous",
    description:
      "Liste les rendez-vous entre deux dates incluses (YYYY-MM-DD), éventuellement filtrés par opérateur ou client. Inclut opérateur, client, adresse, prestation, statut et prix.",
    input_schema: {
      type: "object",
      properties: {
        du: { type: "string", description: "Date de début YYYY-MM-DD" },
        au: { type: "string", description: "Date de fin YYYY-MM-DD (incluse)" },
        operateurId: { type: "string" },
        clientId: { type: "string" },
        inclureAnnules: { type: "boolean" },
      },
      required: ["du", "au"],
    },
  },
  {
    name: "lister_operateurs",
    description: "Liste les opérateurs (salariés) : statut, horaires, secteur, téléphone, véhicule, nombre de RDVà venir.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "catalogue",
    description: "Packs (prestations) avec description, durées et prix par catégorie de véhicule, et options payantes.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "lister_devis",
    description: "Liste les devis du pipeline commercial avec leur statut (envoyé, consulté, accepté, acompte payé, RDV créé, refusé).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "proposer_operateurs",
    description:
      "Moteur « trouver le meilleur opérateur » : classe les opérateurs disponibles pour un rendez-vous (proximité, disponibilité, charge). À utiliser avant d'affecter si on ne sait pas qui mettre.",
    input_schema: {
      type: "object",
      properties: { rendezVousId: { type: "string" } },
      required: ["rendezVousId"],
    },
  },
  {
    name: "journal_sms",
    description: "Derniers SMS envoyés (destinataire, message, motif, statut).",
    input_schema: { type: "object", properties: { limite: { type: "integer" } } },
  },
];

const OUTIL_FINANCES = {
  name: "finances",
  description:
    "Finances (réservé au patron) : CA du jour, de la semaine et du mois, acomptes, soldes restants, commission réseau, dépenses et marge estimée, CA par opérateur.",
  input_schema: { type: "object", properties: {} },
};

const OUTILS_ACTION = [
  {
    name: "creer_client",
    description:
      "Crée une fiche client avec son adresse d'intervention et son véhicule. Vérifier d'abord avec rechercher_clients qu'il n'existe pas déjà.",
    input_schema: {
      type: "object",
      properties: {
        prenom: { type: "string" },
        nom: { type: "string" },
        telephone: { type: "string" },
        email: { type: "string" },
        adresse: { type: "string", description: "Numéro et rue" },
        codePostal: { type: "string" },
        ville: { type: "string" },
        categorieVehicule: { type: "string", enum: CATEGORIES_VEHICULE },
        marque: { type: "string" },
        modele: { type: "string" },
        immatriculation: { type: "string" },
      },
      required: ["prenom", "nom", "telephone", "adresse", "ville", "categorieVehicule"],
    },
  },
  {
    name: "creer_rendez_vous",
    description:
      "Met un rendez-vous au planning pour un client existant. Le prix et l'acompte (10 %) sont calculés automatiquement. Optionnellement affecte directement un opérateur. Le client reçoit un SMS de confirmation si envoyerSmsest vrai.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        packId: { type: "string" },
        dateHeure: { type: "string", description: "Date et heure locales YYYY-MM-DDTHH:mm" },
        adresseId: { type: "string", description: "Facultatif si le client n'a qu'une adresse" },
             vehiculeId: { type: "string", description: "Facultatif si le client n'a qu'un véhicule" },
             optionIds: { type: "array", items: { type: "string" } },
             operateurId: { type: "string", description: "Facultatif : opérateur à affecter directement" },
             notes: { type: "string" },
             envoyerSms: { type: "boolean", description: "SMS de confirmation au client (et d'affectation si opérateur)" },
      },
      required: ["clientId", "packId", "dateHeure", "envoyerSms"],
    },
  },
  {
    name: "affecter_operateur",
    description:
      "Met un opérateur sur un rendez-vous (le confirme s'il était en attente). Prévient l'opérateur et le client par SMS si envoyerSms est vrai. Signale les chevauchements avec ses autres RDV.",
    input_schema: {
      type: "object",
      properties: {
        rendezVousId: { type: "string" },
        operateurId: { type: "string" },
        envoyerSms: { type: "boolean" },
      },
      required: ["rendezVousId", "operateurId", "envoyerSms"],
    },
  },
  {
    name: "modifier_rendez_vous",
    description: "Déplace un rendez-vous à une nouvelle date/heure, ou l'annule. Prévient le client par SMS si envoyerSms est vrai.",
    input_schema: {
      type: "object",
      properties: {
        rendezVousId: { type: "string" },
        nouvelleDateHeure: { type: "string", description: "YYYY-MM-DDTHH:mm" },
        annuler: { type: "boolean" },
        envoyerSms: { type: "boolean" },
      },
      required: ["rendezVousId", "envoyerSms"],
    },
  },
  {
    name: "convertir_devis_en_rdv",
    description: "Transforme un devis dont l'acompte est payé en rendez-vous au planning (crée la fiche client sibesoin).",
    input_schema: {
      type: "object",
      properties: { devisId: { type: "string" }, dateHeure: { type: "string", description: "YYYY-MM-DDTHH:mm" }},
      required: ["devisId", "dateHeure"],
    },
  },
  {
    name: "envoyer_sms",
    description:
      "Envoie un SMS au client ou à l'opérateur d'un rendez-vous, à un client, à un opérateur, ou à un numéro. Message court et poli, signé X Detailing.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        rendezVousId: { type: "string" },
        destinataire: { type: "string", enum: ["client", "operateur"], description: "Avec rendezVousId" },
        clientId: { type: "string" },
        operateurId: { type: "string" },
        telephone: { type: "string", description: "Numéro libre (avec nomDestinataire)" },
        nomDestinataire: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "envoyer_rappels",
    description: "Envoie le SMS de rappel à tous les clients ayant un rendez-vous à la date donnée (en général demain). Pas de doublon.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "YYYY-MM-DD" } },
      required: ["date"],
    },
  },
];

export function outilsLola(session: SessionPayload): Anthropic.Beta.BetaTool[] {
  const outils = [...OUTILS_LECTURE, ...(session.role === "OWNER" ? [OUTIL_FINANCES] : []), ...OUTILS_ACTION];
  return outils as Anthropic.Beta.BetaTool[];
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

class ErreurOutil extends Error {}

function texte(entree: Entree, champ: string, requis = false) {
  const valeur = entree[champ];
  if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
  if (requis) throw new ErreurOutil(`paramètre « ${champ} » manquant`);
  return undefined;
}

// « YYYY-MM-DD » ou « YYYY-MM-DDTHH:mm », toujours en heure de Paris.
function dateLocale(valeur: string, champ: string) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(valeur);
  const date = m ? dateParis(m[1], m[2] ?? "00:00") : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new ErreurOutil(`« ${champ} » n'est pas une date valide (${valeur})`);
  return date;
}

function jourValide(valeur: string, champ: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) throw new ErreurOutil(`« ${champ} » doit être au format YYYY-MM-DD(${valeur})`);
  return valeur;
}

const libelleDate = libelleDateHeure;

async function resumeRdv(id: string) {
  const ligne = await db.rendezVous.findUnique({
    where: { id },
    include: { client: true, adresse: true, vehicule: true, pack: true, operateur: true },
  });
  if (!ligne) return null;
  const r = versRdv(ligne);
  const { client, adresse, vehicule, pack, operateur } = r;
  return {
    id: r.id,
    quand: libelleDate(r.dateHeure),
    dateHeure: r.dateHeure.toISOString(),
    dureeMinutes: r.dureeMinutes,
    statut: r.statut,
    prestation: pack?.nom,
    client: client ? { id: client.id, nom: `${client.prenom} ${client.nom}`, telephone: client.telephone } : null,
    adresse: adresse ? `${adresse.adresse}, ${adresse.codePostal ?? ""} ${adresse.ville}`.replace(/\s+/g, " ") :null,
    vehicule: vehicule ? [vehicule.marque, vehicule.modele, vehicule.categorie].filter(Boolean).join(" ") : null,
    operateur: operateur ? { id: operateur.id, nom: `${operateur.prenom} ${operateur.nom}` } : null,
    prixTotal: r.prixTotal,
    acompte: r.acompte,
    notes: r.notes,
  };
}

async function resumeSms(id: string) {
  const s = await db.sms.findUnique({ where: { id } });
  return s && { id: s.id, a: s.destinataire, telephone: s.telephone, message: s.message, statut: s.statut, erreur: s.erreur };
}

async function finances() {
  const maintenant = new Date();
  const jour = debutJourParis(maintenant);
  const semaine = debutSemaineParis(maintenant);
  const mois = debutMoisParis(maintenant);
  const rdvMois = sansDecimal(
    await db.rendezVous.findMany({
      where: { statut: { not: "ANNULE" }, dateHeure: { gte: mois } },
      select: { dateHeure: true, prixTotal: true, acompte: true, operateurId: true },
    })
  );
  const ca = (depuis: Date) => rdvMois.filter((r) => r.dateHeure >= depuis).reduce((t, r) => t + r.prixTotal, 0);
  const caMois = ca(mois);
  const depenses = sansDecimal(await db.depensesMensuelles.findUnique({ where: { mois: moisParis(maintenant) }}));
  const depensesMois = depenses?.depenses ?? 0;
  const publiciteMois = depenses?.publicite ?? 0;
  const commission = Math.round(caMois * TAUX_COMMISSION * 100) / 100;
  const operateurs = await db.operateur.findMany();
  const parOperateur = operateurs.map((o) => {
    const rdvs = rdvMois.filter((r) => r.operateurId === o.id);
    return { operateur: `${o.prenom} ${o.nom}`, nbRdv: rdvs.length, ca: rdvs.reduce((t, r) => t + r.prixTotal, 0)};
  });
  return {
    note: "Mois en cours (heure de Paris), RDV non annulés (y compris à venir dans le mois). Estimations, pas des montants comptables.",
    caJour: ca(jour),
    caSemaine: ca(semaine),
    caMois,
    acomptesMois: rdvMois.reduce((t, r) => t + r.acompte, 0),
    soldesRestantsMois: rdvMois.reduce((t, r) => t + r.prixTotal - r.acompte, 0),
    commissionReseauMois: commission,
    depensesMois,
    publiciteMois,
    margeNetteEstimeeMois: caMois - commission - depensesMois - publiciteMois,
    parOperateur,
  };
}

async function executer(nom: string, entree: Entree, ctx: ContexteOutils): Promise<unknown> {
  const { session } = ctx;
  const auteur = session.email;

  switch (nom) {
    case "rechercher_clients": {
      const q = (texte(entree, "recherche") ?? "").trim();
      const chiffres = q.replace(/\D/g, "");
      const mots = q.split(/\s+/).filter(Boolean);
      const clients = await db.client.findMany({
        where: q
          ? {
              OR: [
                ...(chiffres.length >= 4 ? [{ telephone: { contains: chiffres.slice(-4) } }] : []),
                {
                  AND: mots.map((m) => ({
                    OR: [{ prenom: { contains: m, mode: "insensitive" as const } }, { nom: { contains: m, mode:"insensitive" as const } }],
                  })),
                },
              ],
            }
          : undefined,
        include: { adresses: true, vehicules: true, _count: { select: { rendezVous: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      });
      return clients.map((c) => ({
        id: c.id,
        nom: `${c.prenom} ${c.nom}`,
        telephone: c.telephone,
        email: c.email,
        adresses: c.adresses.map((a) => ({ id: a.id, libelle: a.libelle, adresse: `${a.adresse}, ${a.ville}`, geolocalisee: a.latitude != null })),
        vehicules: c.vehicules.map((v) => ({ id: v.id, categorie: v.categorie, vehicule: [v.marque, v.modele].filter(Boolean).join(" "), immatriculation: v.immatriculation })),
        nbRendezVous: c._count.rendezVous,
      }));
    }

      case "lister_rendez_vous": {
        const du = dateParis(jourValide(texte(entree, "du", true)!, "du"));
        const au = dateParis(decalerJour(jourValide(texte(entree, "au", true)!, "au"), 1));
        const operateurId = texte(entree, "operateurId");
        const clientId = texte(entree, "clientId");
        const rdvs = await db.rendezVous.findMany({
          where: {
            dateHeure: { gte: du, lt: au },
              statut: entree.inclureAnnules === true ? undefined : { not: "ANNULE" },
              operateurId: operateurId ?? undefined,
              clientId: clientId ?? undefined,
            },
            orderBy: { dateHeure: "asc" },
            take: 60,
            select: { id: true },
          });
          return Promise.all(rdvs.map((r) => resumeRdv(r.id)));
      }

    case "lister_operateurs": {
      const operateurs = await db.operateur.findMany({
        include: {
          secteur: true,
          _count: { select: { rendezVous: { where: { dateHeure: { gte: new Date() }, statut: { not: "ANNULE" } }} } },
        },
      });
      return operateurs.map((o) => ({
        id: o.id,
        nom: `${o.prenom} ${o.nom}`,
        statut: o.statut,
        horaires: `${o.heureDebut}–${o.heureFin}`,
        secteur: o.secteur?.nom ?? null,
        telephone: o.telephone,
        kangoo: o.kangooImmatriculation,
        rdvAVenir: o._count.rendezVous,
      }));
    }

      case "catalogue":
        return {
          packs: (await listerPacksAvecTarifs()).map((p) => ({
            id: p.id,
            nom: p.nom,
            description: p.description,
            duree: `${p.dureeMinMinutes}–${p.dureeMaxMinutes} min`,
            prixParCategorie: Object.fromEntries(p.tarifs.map((t) => [t.categorie, t.prix])),
          })),
          options: (await listerOptionsActives()).map((o) => ({
            id: o.id,
            nom: o.nom,
            prix: o.prix,
            rubrique: o.groupe,
            ...(o.unite ? { parUnite: o.unite, quantiteMax: o.quantiteMax } : {}),
          })),
          acompte: "10 % du prix total, demandé à la réservation",
        };

    case "lister_devis": {
      const devis = sansDecimal(await db.devis.findMany({ include: { pack: true }, orderBy: { createdAt: "desc"}, take: 50 }));
      return devis.map((d) => ({
        id: d.id,
        client: d.raisonSociale ? `${d.nomClient} (${d.raisonSociale})` : d.nomClient,
        telephone: d.telephoneClient,
        ville: d.ville,
        vehicule: d.vehiculeDescription,
        pack: d.pack.nom,
        prixTotal: d.prixTotal,
        statut: d.statut,
        creeLe: formatParis(d.createdAt, { dateStyle: "short" }),
        rendezVousId: d.rendezVousId,
      }));
    }

    case "proposer_operateurs": {
      const rdv = await trouverRendezVous(texte(entree, "rendezVousId", true)!);
      if (!rdv) throw new ErreurOutil("rendez-vous introuvable");
      const adresse = await db.adresse.findUnique({ where: { id: rdv.adresseId } });
      if (adresse?.latitude == null || adresse.longitude == null) {
        throw new ErreurOutil("adresse non géolocalisée : impossible de calculer les trajets, choisir l'opérateur manuellement");
      }
      const candidats = await evaluerCandidats({
        latitude: adresse.latitude,
        longitude: adresse.longitude,
        dateHeure: rdv.dateHeure,
            dureeMinutes: rdv.dureeMinutes,
            excludeRendezVousId: rdv.id,
          });
          ctx.rdvTouches.add(rdv.id);
          return candidats.map((c) => ({
            operateurId: c.operateurId,
            nom: c.nomComplet,
            score: Math.round(c.score * 100) / 100,
            distanceKm: Math.round(c.distanceKm * 10) / 10,
            trajetMinutes: Math.round(c.etaMinutes),
            prestationsCeJour: c.nbPrestationsJour,
            ...(session.role === "OWNER" ? { caJour: c.caJour } : {}),
          }));
      }

      case "journal_sms": {
        const limite = typeof entree.limite === "number" ? Math.min(50, entree.limite) : 15;
        const sms = await db.sms.findMany({ orderBy: { createdAt: "desc" }, take: limite });
        return {
          mode: smsReelsActives() ? "réel (Twilio)" : "simulé (aucun fournisseur SMS configuré)",
          sms: sms.map((s) => ({
            id: s.id,
            a: s.destinataire,
            telephone: s.telephone,
            message: s.message,
            statut: s.statut,
            erreur: s.erreur,
            motif: s.motif,
            le: libelleDate(s.createdAt),
          })),
        };
      }

      case "finances":
        if (session.role !== "OWNER") throw new ErreurOutil("accès refusé");
        return finances();

    case "creer_client": {
      const categorie = texte(entree, "categorieVehicule", true)!;
      if (!CATEGORIES_VEHICULE.includes(categorie as never)) throw new ErreurOutil("catégorie de véhicule invalide");
      const client = await creerClient({
        prenom: texte(entree, "prenom", true)!,
        nom: texte(entree, "nom", true)!,
        telephone: texte(entree, "telephone", true)!,
        email: texte(entree, "email") ?? null,
        adresse: { adresse: texte(entree, "adresse", true)!, ville: texte(entree, "ville", true)!, codePostal: texte(entree, "codePostal") ?? null },
        vehicule: {
          categorie: categorie as (typeof CATEGORIES_VEHICULE)[number],
          marque: texte(entree, "marque") ?? null,
          modele: texte(entree, "modele") ?? null,
          immatriculation: texte(entree, "immatriculation") ?? null,
        },
      });
      ctx.modifie = true;
      return {
        clientId: client.id,
        adresseId: client.adresses[0]?.id,
        vehiculeId: client.vehicules[0]?.id,
        adresseGeolocalisee: client.adresses[0]?.latitude != null,
      };
    }

    case "creer_rendez_vous": {
      const clientId = texte(entree, "clientId", true)!;
      const client = await db.client.findUnique({ where: { id: clientId }, include: { adresses: true, vehicules:true } });
      if (!client) throw new ErreurOutil("client introuvable");
      const { adresses, vehicules } = client;
      const adresseId = texte(entree, "adresseId") ?? (adresses.length === 1 ? adresses[0].id : undefined);
      const vehiculeId = texte(entree, "vehiculeId") ?? (vehicules.length === 1 ? vehicules[0].id : undefined);
      if (!adresseId || !adresses.some((a) => a.id === adresseId)) {
        throw new ErreurOutil(adresses.length ? "préciser adresseId (le client a plusieurs adresses)" : "le client n'a pas d'adresse enregistrée");
      }
      if (!vehiculeId || !vehicules.some((v) => v.id === vehiculeId)) {
        throw new ErreurOutil(vehicules.length ? "préciser vehiculeId (le client a plusieurs véhicules)" : "le client n'a pas de véhicule enregistré");
      }
      const operateurId = texte(entree, "operateurId");
      if (operateurId && !(await db.operateur.findUnique({ where: { id: operateurId } }))) throw new ErreurOutil("opérateur inconnu");

        const adresse = adresses.find((a) => a.id === adresseId)!;
        const secteur = await db.secteur.findFirst({ where: { ville: adresse.ville } });
        const resultat = await creerRendezVous({
          clientId,
          adresseId,
          vehiculeId,
          packId: texte(entree, "packId", true)!,
          dateHeure: dateLocale(texte(entree, "dateHeure", true)!, "dateHeure"),
          optionIds: Array.isArray(entree.optionIds) ? (entree.optionIds as string[]) : [],
          secteurId: secteur?.id ?? null,
          notes: texte(entree, "notes") ?? null,
          source: "TELEPHONE",
        });
        if (!resultat.ok) throw new ErreurOutil(resultat.erreur);
        const rdv = resultat.valeur;
        await historiserRdv(rdv, `Créé par Lola à la demande de ${auteur}.`);
        await journaliser({ acteur: session, action: "RDV_CREE_PAR_LOLA", entite: "RendezVous", entiteId: rdv.id});
        ctx.modifie = true;
        ctx.rdvTouches.add(rdv.id);

        const avertissements: string[] = [];
        if (operateurId) {
          const conflits = await conflitsOperateur(operateurId, rdv.dateHeure, rdv.dureeMinutes, rdv.id);
          if (conflits.length) avertissements.push(`chevauche ${conflits.length} autre(s) RDV de cet opérateur`);
          await appliquerAffectation(rdv, operateurId);
          await changerStatut(rdv, "CONFIRME");
        }
        const envoyes: string[] = [];
        if (entree.envoyerSms === true) {
          const sms = await smsAuClient(rdv, await MODELES_SMS.confirmationClient(rdv), "CONFIRMATION_RDV", auteur);
        if (sms) envoyes.push(sms.id);
        if (operateurId) {
          const smsOp = await smsAOperateur(rdv, await MODELES_SMS.affectationOperateur(rdv), "AFFECTATION_OPERATEUR", auteur);
          if (smsOp) envoyes.push(smsOp.id);
        }
      }
      ctx.smsEnvoyes.push(...envoyes);
      return { rendezVous: await resumeRdv(rdv.id), avertissements, smsEnvoyes: await Promise.all(envoyes.map(resumeSms)) };
    }

    case "affecter_operateur": {
      const rdv = await trouverRendezVous(texte(entree, "rendezVousId", true)!);
      if (!rdv) throw new ErreurOutil("rendez-vous introuvable");
      const operateurId = texte(entree, "operateurId", true)!;
      const operateur = await db.operateur.findUnique({ where: { id: operateurId } });
      if (!operateur) throw new ErreurOutil("opérateur inconnu");
      const avertissements: string[] = [];
      if (operateur.statut !== "ACTIF") avertissements.push("opérateur suspendu");
      const conflits = await conflitsOperateur(operateurId, rdv.dateHeure, rdv.dureeMinutes, rdv.id);
      if (conflits.length) {
        avertissements.push(`chevauche : ${conflits.map((c) => libelleDate(c.dateHeure)).join(", ")}`);
      }
      const change = await appliquerAffectation(rdv, operateurId);
      if (rdv.statut === "EN_ATTENTE") await changerStatut(rdv, "CONFIRME");
      if (change) await journaliser({ acteur: session, action: "AFFECTATION_PAR_LOLA", entite: "RendezVous", entiteId: rdv.id, details: { operateurId } });
      ctx.modifie = true;
      ctx.rdvTouches.add(rdv.id);
      const sms = change && entree.envoyerSms === true ? await notifierAffectation(rdv, auteur) : [];
      ctx.smsEnvoyes.push(...sms.map((s) => s.id));
      return {
        rendezVous: await resumeRdv(rdv.id),
        dejaAffecte: !change,
        avertissements,
        smsEnvoyes: await Promise.all(sms.map((s) => resumeSms(s.id))),
      };
    }

      case "modifier_rendez_vous": {
        const rdv = await trouverRendezVous(texte(entree, "rendezVousId", true)!);
      if (!rdv) throw new ErreurOutil("rendez-vous introuvable");
      const nouvelle = texte(entree, "nouvelleDateHeure");
      if (!nouvelle && entree.annuler !== true) throw new ErreurOutil("rien à modifier : nouvelleDateHeure ou annuler");
      const avertissements: string[] = [];
      let message: string;
      if (entree.annuler === true) {
        await changerStatut(rdv, "ANNULE" satisfies StatutRendezVous);
        await journaliser({ acteur: session, action: "RDV_ANNULE_PAR_LOLA", entite: "RendezVous", entiteId: rdv.id });
        message = await MODELES_SMS.annulationClient(rdv);
      } else {
        await deplacerRendezVous(rdv, dateLocale(nouvelle!, "nouvelleDateHeure"));
        await journaliser({ acteur: session, action: "RDV_DEPLACE_PAR_LOLA", entite: "RendezVous", entiteId: rdv.id, details: { dateHeure: rdv.dateHeure.toISOString() } });
        if (rdv.operateurId) {
          const conflits = await conflitsOperateur(rdv.operateurId, rdv.dateHeure, rdv.dureeMinutes, rdv.id);
          if (conflits.length) avertissements.push(`l'opérateur a déjà ${conflits.length} RDV sur ce créneau`);
        }
        message = await MODELES_SMS.modificationClient(rdv);
      }
      ctx.modifie = true;
      ctx.rdvTouches.add(rdv.id);
      const sms =
        entree.envoyerSms === true
          ? await smsAuClient(rdv, message, entree.annuler === true ? "ANNULATION_RDV" : "MODIFICATION_RDV", auteur)
          : null;
      if (sms) ctx.smsEnvoyes.push(sms.id);
      return { rendezVous: await resumeRdv(rdv.id), avertissements, smsEnvoye: sms ? await resumeSms(sms.id) : null };
    }

    case "convertir_devis_en_rdv": {
      const devis = await trouverDevis(texte(entree, "devisId", true)!);
      if (!devis) throw new ErreurOutil("devis introuvable");
      const resultat = await convertirDevisEnRdv(devis, dateLocale(texte(entree, "dateHeure", true)!, "dateHeure"));
      if (!resultat.ok) throw new ErreurOutil(resultat.error);
      ctx.modifie = true;
      ctx.rdvTouches.add(resultat.rendezVousId);
      return { rendezVous: await resumeRdv(resultat.rendezVousId) };
    }

    case "envoyer_sms": {
      const message = texte(entree, "message", true)!;
      const rdvId = texte(entree, "rendezVousId");
      let sms = null;
      if (rdvId) {
        const rdv = await trouverRendezVous(rdvId);
        if (!rdv) throw new ErreurOutil("rendez-vous introuvable");
        sms =
          entree.destinataire === "operateur"
            ? await smsAOperateur(rdv, message, "MANUEL", auteur)
            : await smsAuClient(rdv, message, "MANUEL", auteur);
        if (!sms) throw new ErreurOutil(entree.destinataire === "operateur" ? "aucun opérateur sur ce RDV" : "client introuvable");
      } else {
        const clientId = texte(entree, "clientId");
        const operateurId = texte(entree, "operateurId");
        const client = clientId ? await db.client.findUnique({ where: { id: clientId } }) : null;
        const operateur = operateurId ? await db.operateur.findUnique({ where: { id: operateurId } }) : null;
        const telephone = texte(entree, "telephone");
        const cible = client
          ? { destinataire: `${client.prenom} ${client.nom}`, telephone: client.telephone }
          : operateur
            ? { destinataire: `${operateur.prenom} ${operateur.nom}`, telephone: operateur.telephone }
            : telephone
              ? { destinataire: texte(entree, "nomDestinataire") ?? telephone, telephone }
              : null;
        if (!cible) throw new ErreurOutil("destinataire manquant : rendezVousId, clientId, operateurId ou telephone");
        sms = await envoyerSms({ ...cible, message, motif: "MANUEL", envoyePar: auteur });
      }
      ctx.smsEnvoyes.push(sms.id);
      ctx.modifie = true;
      return resumeSms(sms.id);
    }

        case "envoyer_rappels": {
          const sms = await envoyerRappels(jourValide(texte(entree, "date", true)!, "date"), auteur);
          ctx.smsEnvoyes.push(...sms.map((s) => s.id));
          ctx.modifie = sms.length > 0 || ctx.modifie;
          return { nbEnvoyes: sms.length, sms: await Promise.all(sms.map((s) => resumeSms(s.id))) };
        }

        default:
          throw new ErreurOutil(`outil inconnu : ${nom}`);
    }
}

export async function executerOutil(
  nom: string,
  entree: unknown,
  ctx: ContexteOutils
): Promise<{ contenu: string; erreur: boolean }> {
  try {
    const resultat = await executer(nom, (entree ?? {}) as Entree, ctx);
    return { contenu: JSON.stringify(resultat), erreur: false };
  } catch (e) {
    if (!(e instanceof ErreurOutil)) console.error(`Lola : outil ${nom} en échec`, e);
    return { contenu: e instanceof Error ? e.message : String(e), erreur: true };
  }
}

