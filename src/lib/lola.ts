// Lola — assistante vocale de l'écran d'accueil du back-office. Le patron
// lui parle (micro du navigateur) ; elle répond à voix haute sur tout ce qui
// touche X Detailing (planning, clients, devis, tarifs, finances pour le
// patron) et AGIT : met des RDV au planning, affecte les opérateurs,
// déplace/annule, envoie des SMS (outils : src/lib/lolaOutils.ts). Chaque
// rendez-vous ou SMS dont elle parle apparaît à l'écran au moment où elle
// l'annonce (voir src/components/lola/).
//
// Une réponse est donc une suite de SEGMENTS : une phrase à prononcer,
// éventuellement accompagnée de la carte du RDV ou du SMS dont elle parle.
//
// Les réponses sont générées par Claude quand ANTHROPIC_API_KEY est défini.
// Sans clé (cas par défaut, conforme au « zéro variable d'environnement »
// du projet), un moteur de réponses local couvre les questions courantes
// sur le planning (aujourd'hui, demain, un jour, un opérateur, la semaine,
// RDV non affectés) mais ne peut pas agir.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { listerRendezVousAvecRelations, rendezVousAvecRelations, type RdvComplet } from "@/lib/queries";
import { dateParis, decalerJour, formatParis, jourParis, jourSemaineParis } from "@/lib/heure";
import type { SessionPayload } from "@/lib/auth";
import { executerOutil, outilsLola, type ContexteOutils } from "@/lib/lolaOutils";
import { smsReelsActives } from "@/lib/sms";

const NB_JOURS = 7;
const NB_TOURS_OUTILS_MAX = 12;

export type MessageLola = { role: "user" | "assistant"; content: string };

export type CarteRdvLola = {
  id: string;
  jour: string;
  heure: string;
  operateur: string | null;
  prestation: string;
  client: string;
  adresse: string;
  ville: string;
  vehicule: string;
  dureeMinutes: number;
  statut: string;
};

export type CarteSmsLola = {
  id: string;
  destinataire: string;
  telephone: string;
  message: string;
  statut: "envoyé" | "simulé" | "échec";
};

export type SegmentLola = { texte: string; carte: CarteRdvLola | null; sms?: CarteSmsLola | null };

export type ReponseLola = {
  segments: SegmentLola[];
  mode: "claude" | "local";
  // Les données ont changé : l'écran d'accueil doit se rafraîchir.
  modifie: boolean;
  // Identifiants des RDV/SMS touchés, à garder dans l'historique de la
  // conversation pour les questions de suite (« envoie-lui un SMS »).
  memoire: string | null;
};

const LIBELLE_STATUT: Record<string, string> = {
  EN_ATTENTE: "en attente",
  CONFIRME: "confirmé",
  EN_ROUTE: "en route",
  ARRIVE: "arrivé",
  CONTROLE: "contrôle & signature",
  PHOTOS_AVANT: "photos avant",
  LAVAGE: "prestation en cours",
  PHOTOS_APRES: "photos après",
  PAIEMENT: "paiement",
  EN_COURS: "en cours",
  TERMINE: "terminé",
  ANNULE: "annulé",
};

// Façon de dire la prestation à l'oral (le nom commercial du pack seul
// ne parle pas forcément à l'équipe).
const PRESTATION_ORALE: Record<string, string> = {
  "pack-concession": "un nettoyage intérieur",
  "pack-concession-luxe": "un nettoyage intérieur et extérieur",
};

function libelleJour(date: Date) {
  return formatParis(date, { weekday: "long", day: "numeric", month: "long" });
}

function heure(date: Date) {
  return formatParis(date, { hour: "2-digit", minute: "2-digit" });
}

function carteRdv(r: RdvComplet): CarteRdvLola {
  return {
    id: r.id,
    jour: libelleJour(r.dateHeure),
    heure: heure(r.dateHeure),
    operateur: r.operateur ? `${r.operateur.prenom} ${r.operateur.nom}` : null,
    prestation: r.pack.nom,
    client: `${r.client.prenom} ${r.client.nom}`,
    adresse: r.adresse.adresse,
    ville: r.adresse.ville,
    vehicule: [r.vehicule.marque, r.vehicule.modele].filter(Boolean).join(" ") || r.categorieVehicule,
    dureeMinutes: r.dureeMinutes,
    statut: LIBELLE_STATUT[r.statut] ?? r.statut,
  };
}

async function carteRdvParId(id: string) {
  const r = await rendezVousAvecRelations(id);
  return r ? carteRdv(r) : null;
}

async function carteSmsParId(id: string): Promise<CarteSmsLola | null> {
  const s = await db.sms.findUnique({ where: { id } });
  if (!s) return null;
  const statut = s.statut === "ENVOYE" ? "envoyé" : s.statut === "SIMULE" ? "simulé" : "échec";
  return { id: s.id, destinataire: s.destinataire, telephone: s.telephone, message: s.message, statut };
}

// Prénom de la personne à qui Lola s'adresse (fiche opérateur liée au
// compte, ex. Mathieu pour l'OWNER), sinon null.
export async function prenomInterlocuteur(session: SessionPayload) {
  if (!session.operateurId) return null;
  return (await db.operateur.findUnique({ where: { id: session.operateurId } }))?.prenom ?? null;
}

// Planning des 7 prochains jours, structuré par jour. Les montants ne
// sont inclus que pour l'OWNER : un COMMERCIAL ne doit jamais voir de
// données financières, même reformulées par l'assistante.
export async function planningSemaine(session: SessionPayload) {
  const aujourdhui = jourParis(new Date());
  const debut = dateParis(aujourdhui);
  const fin = dateParis(decalerJour(aujourdhui, NB_JOURS));

  const rendezVous = await listerRendezVousAvecRelations({ dateHeure: { gte: debut, lt: fin }, statut: { not: "ANNULE" } });
  const operateurs = await db.operateur.findMany({ where: { statut: "ACTIF" }, orderBy: { prenom: "asc" } });

  const jours = Array.from({ length: NB_JOURS }, (_, i) => {
    const jour = dateParis(decalerJour(aujourdhui, i));
    const lendemain = dateParis(decalerJour(aujourdhui, i + 1));
    const rdvs = rendezVous
      .filter((r) => r.dateHeure >= jour && r.dateHeure < lendemain)
      .map((r) => ({
        operateurId: r.operateurId,
        prenomOperateur: r.operateur?.prenom ?? null,
        prestationOrale: PRESTATION_ORALE[r.packId] ?? `une prestation ${r.pack.nom}`,
        prixTotal: session.role === "OWNER" ? r.prixTotal : null,
        carte: carteRdv(r),
      }));
    return { date: jour, jourSemaine: jourSemaineParis(new Date(jour.getTime() + 12 * 3600000)), libelle: libelleJour(jour), rdvs };
  });

    return {
      jours,
      operateurs: operateurs.map((o) => ({
        id: o.id,
        nom: `${o.prenom} ${o.nom}`,
        prenom: o.prenom,
        horaires: `${o.heureDebut}–${o.heureFin}`,
      })),
    };
}

type Planning = Awaited<ReturnType<typeof planningSemaine>>;
type RdvPlanning = Planning["jours"][number]["rdvs"][number];

function planningEnTexte(planning: Planning) {
  const lignes: string[] = [
    "Opérateurs actifs : " + planning.operateurs.map((o) => `${o.nom} (${o.horaires})`).join(", ") + ".",
    "",
  ];
  for (const jour of planning.jours) {
    lignes.push(`## ${jour.libelle}`);
    if (jour.rdvs.length === 0) lignes.push("- aucun rendez-vous");
    for (const r of jour.rdvs) {
      const c = r.carte;
      const prix = r.prixTotal !== null ? ` · ${r.prixTotal} €` : "";
      lignes.push(
        `- [${c.id}] ${c.heure} · ${c.operateur ?? "NON AFFECTÉ"} · ${r.prestationOrale} (pack ${c.prestation},${c.dureeMinutes} min) · client ${c.client} · ${c.adresse}, ${c.ville} · ${c.vehicule} · ${c.statut}${prix}`
      );
    }
    }
    return lignes.join("\n");
}

// ---------------------------------------------------------------------------
// Réponse via Claude
// ---------------------------------------------------------------------------

function calendrier() {
  const jours: string[] = [];
  const aujourdhui = jourParis(new Date());
  for (let i = 0; i < 21; i++) {
    const iso = decalerJour(aujourdhui, i);
    jours.push(`${libelleJour(dateParis(iso, "12:00"))} = ${iso}`);
  }
  return jours.join(" ; ");
}

async function promptSysteme(session: SessionPayload, planning: Planning) {
  const maintenant = new Date();
  const prenom = await prenomInterlocuteur(session);
  const owner = session.role === "OWNER";
  return `Tu es Lola, l'assistante vocale de X Detailing. Tu vis sur l'écran d'accueil du back-office, sous la forme d'une planète animée. Tu parles avec ${
    owner ? `le patron${prenom ? `, ${prenom}` : ""}` : "un membre de l'équipe commerciale"
  }, qui te parle à voix haute depuis le bureau.

# X Detailing
Entreprise de lavage automobile MOBILE : les opérateurs (salariés) se déplacent chez le client (domicile, bureau)avec leur Kangoo équipé, à Lyon et Villeurbanne. Les prestations sont des packs (Concession = nettoyage intérieur; Concession Luxe = nettoyage intérieur et extérieur) dont le prix dépend de la catégorie du véhicule (citadine,berline, SUV, monospace, utilitaire), plus des options. Un acompte de 10 % est demandé à la réservation. Les rendez-vous passent par les statuts : en attente (sans opérateur), confirmé, en route, contrôle et signature, photosavant, lavage, photos après, paiement, terminé (ou annulé). Le client suit son opérateur sur une page de suivi etnote la prestation. Les commerciaux envoient des devis (envoyé, consulté, accepté, acompte payé, transformé en RDV).${
    owner ? " X Detailing prélève une commission réseau de 18 % du CA." : ""
  }

# Ton rôle
Répondre à tout ce qui concerne X Detailing (planning, opérateurs, clients, devis, tarifs, SMS${owner ? ", finances" : ""}) et agir à la demande : mettre des rendez-vous au planning, créer des clients, affecter des opérateurs,déplacer ou annuler des rendez-vous, envoyer des SMS et les rappels de la veille. Utilise tes outils pour toute information absente du planning ci-dessous et pour toute action ; n'invente jamais un identifiant, une adresse, unprix ou un numéro.${
    owner ? "" : " Tu n'as pas accès aux finances (CA, commissions, marges) : si on te les demande, dis que c'estréservé à la direction."
  }
Si la demande sort du cadre de X Detailing, réponds brièvement et poliment que tu es là pour l'entreprise.

# Avant d'agir
- Pour une action qui modifie les données ou envoie un SMS, récapitule d'abord en une phrase ce que tu vas faire(qui, quoi, quand, où, et si un SMS part) et demande « Je confirme ? ». N'exécute l'action qu'après un oui explicite de l'interlocuteur à ce récapitulatif. Une demande déjà très explicite suivie de « oui » vaut confirmation :ne redemande pas.
- S'il manque une information indispensable (client, date, heure, prestation, adresse), pose UNE question courte.
- Pour un nouveau client, vérifie d'abord qu'il n'existe pas (rechercher_clients). Pour choisir un opérateur, propose le meilleur via proposer_operateurs si on ne te l'impose pas.
- Par défaut, préviens par SMS (envoyerSms vrai) le client et l'opérateur concernés, et dis-le dans ton récapitulatif ; ne le fais pas si on te demande de ne pas les prévenir.
- Après une action, dis ce qui a été fait et signale les avertissements (chevauchement, adresse non géolocalisée,SMS en échec).${
    smsReelsActives() ? "" : "\n- Aucun fournisseur SMS n'est encore branché : les SMS sont simulés (consignés dans le journal, pas réellement envoyés). Mentionne-le brièvement la première fois que tu en envoies un."
  }

# Format de réponse
Une liste de segments, prononcés l'un après l'autre par une synthèse vocale.
- Chaque segment est une ou deux phrases courtes et naturelles, en français, sans markdown ni emoji. Dis les heures comme à l'oral (« 14 heures », « 9 heures 30 ») et les prix en euros (« 149 euros »).
- Quand un segment parle d'un rendez-vous précis, mets son identifiant dans rdvId : sa carte s'affichera à l'écran pendant que tu en parles. Quand il parle d'un SMS que tu viens d'envoyer, mets son identifiant dans smsId. Un rendez-vous et un SMS par segment au maximum ; sinon null.
- Pour le planning : commence par une phrase d'accroche${prenom ? ` qui interpelle ${prenom} par son prénom` :""}, puis un segment par rendez-vous (opérateur, prestation, heure, lieu), et termine si utile par qui n'a rien de prévu ou les RDV à affecter.
- Reste concise : pas plus de 10 segments.

# Repères
Nous sommes le ${libelleJour(maintenant)}, il est ${heure(maintenant)}. Calendrier pour convertir les dates en YYYY-MM-DD : ${calendrier()}.

# Planning des 7 prochains jours
${planningEnTexte(planning)}`;
}

const SCHEMA_REPONSE = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          texte: { type: "string" },
          rdvId: { type: ["string", "null"] },
          smsId: { type: ["string", "null"] },
        },
        required: ["texte", "rdvId", "smsId"],
        additionalProperties: false,
      },
    },
  },
  required: ["segments"],
  additionalProperties: false,
};

let client: Anthropic | null = null;

async function memoireActions(ctx: ContexteOutils) {
  const lignes = [
    ...(await Promise.all(
      [...ctx.rdvTouches].map(async (id) => {
        const c = await carteRdvParId(id);
        return c && `RDV ${id} : ${c.jour} ${c.heure}, ${c.client}, ${c.operateur ?? "sans opérateur"}, ${c.statut}`;
      })
    )),
    ...(await Promise.all(
      ctx.smsEnvoyes.map(async (id) => {
        const s = await carteSmsParId(id);
        return s && `SMS ${id} à ${s.destinataire} (${s.statut})`;
      })
    )),
  ].filter(Boolean);
  return lignes.length ? `[Références de cet échange — ${lignes.join(" ; ")}]` : null;
}

async function repondreAvecClaude(
  messages: MessageLola[],
  session: SessionPayload,
  planning: Planning
): Promise<Omit<ReponseLola, "mode">> {
  client ??= new Anthropic();
  const ctx: ContexteOutils = { session, rdvTouches: new Set(), smsEnvoyes: [], modifie: false };
  const outils = outilsLola(session);
  const systeme = await promptSysteme(session, planning);
  const historique: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content}));
  const fin = async (segments: SegmentLola[]) => ({ segments, modifie: ctx.modifie, memoire: await memoireActions(ctx) });

   for (let tour = 0; tour < NB_TOURS_OUTILS_MAX; tour++) {
     const reponse = await client.beta.messages.create({
       model: "claude-opus-5-5",
       max_tokens: 8192,
       output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_REPONSE } },
       betas: ["server-side-fallback-2026-07-01"],
       fallbacks: "default",
       system: systeme,
       tools: outils,
       messages: historique,
     });

      if (reponse.stop_reason === "refusal") {
        return fin([{ texte: "Désolée, je ne peux pas répondre à cette demande.", carte: null }]);
      }

      if (reponse.stop_reason === "tool_use") {
        // Le contenu complet (réflexion comprise) est renvoyé tel quel.
        historique.push({ role: "assistant", content: reponse.content });
        const resultats: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        // Séquentiel : l'ordre compte pour des actions qui s'enchaînent.
        for (const bloc of reponse.content) {
          if (bloc.type !== "tool_use") continue;
          const { contenu, erreur } = await executerOutil(bloc.name, bloc.input, ctx);
          resultats.push({ type: "tool_result", tool_use_id: bloc.id, content: contenu, is_error: erreur });
        }
        historique.push({ role: "user", content: resultats });
        continue;
      }

    const texte = reponse.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    try {
      const donnees = JSON.parse(texte) as { segments: { texte: string; rdvId: string | null; smsId: string | null }[] };
      const segments = await Promise.all(
        donnees.segments
          .filter((s) => s.texte.trim())
          .map(async (s) => ({
            texte: s.texte.trim(),
            carte: s.rdvId ? await carteRdvParId(s.rdvId) : null,
            sms: s.smsId ? await carteSmsParId(s.smsId) : null,
          }))
      );
      if (segments.length) return fin(segments);
    } catch {
      // Réponse tronquée (max_tokens) : on retombe sur le message ci-dessous.
    }
    break;
  }
  return fin([
    {
      texte: ctx.modifie
        ? "C'est fait, mais je n'arrive pas à vous le résumer. Regardez le planning pour vérifier."
        : "Je n'ai pas de réponse à vous donner pour le moment.",
      carte: null,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Moteur de réponses local (sans clé API)
// ---------------------------------------------------------------------------

function normaliser(texte: string) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const NOMBRES = ["aucun", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

function nombre(n: number) {
  return NOMBRES[n] ?? String(n);
}

function rendezVous(n: number) {
  return `${nombre(n)} rendez-vous`;
}

function heureOrale(h: string) {
  const [hh, mm] = h.split(":");
  return mm === "00" ? `${Number(hh)} heures` : `${Number(hh)} heures ${mm}`;
}

function majuscule(texte: string) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function enumerer(elements: string[]) {
  if (elements.length <= 1) return elements.join("");
    return `${elements.slice(0, -1).join(", ")} et ${elements[elements.length - 1]}`;
}

// « Sofia et Yanis n'ont rien de prévu » / « Karim et vous n'avez rien… »
function phraseSansRdv(libres: string[], prenom: string | null, quand: string) {
  const autres = libres.filter((p) => p !== prenom);
  if (autres.length === libres.length) {
    return `${enumerer(libres)} ${libres.length > 1 ? "n'ont" : "n'a"} rien de prévu ${quand}.`;
  }
  return autres.length
    ? `${enumerer([...autres, "vous"])} n'avez rien de prévu ${quand}.`
    : `Vous n'avez rien de prévu ${quand}.`;
}

function phraseRdv(r: RdvPlanning, prenom: string | null, avecJour?: string) {
  const c = r.carte;
  const quand = `${avecJour ? `${avecJour} ` : ""}à ${heureOrale(c.heure)}`;
  const ou = `au ${c.adresse} à ${c.ville}`;
  const sujet = !r.prenomOperateur
    ? "Il reste, sans opérateur,"
    : r.prenomOperateur === prenom
      ? "Vous avez"
      : `${r.prenomOperateur} a`;
  return { texte: `${majuscule(`${sujet} ${r.prestationOrale} ${quand}, ${ou}, pour ${c.client}.`)}`, carte: c };
}

function quandOral(jour: Planning["jours"][number], planning: Planning) {
  const index = planning.jours.indexOf(jour);
  if (index === 0) return "aujourd'hui";
  if (index === 1) return "demain";
  return jour.libelle.split(" ")[0]; // « mardi »
}

export function repondreLocalement(question: string, planning: Planning, prenom: string | null): SegmentLola[] {
  const q = normaliser(question);
  const vocatif = prenom ? `, ${prenom}` : "";

    const operateur = planning.operateurs.find((o) => q.includes(normaliser(o.prenom)));

    let jour: Planning["jours"][number] | null = null;
    if (q.includes("aujourd") || q.includes("ce matin") || q.includes("cet apres")) jour = planning.jours[0];
    else if (q.includes("apres-demain") || q.includes("apres demain")) jour = planning.jours[2];
    else if (q.includes("demain")) jour = planning.jours[1];
    else {
      const jourNomme = JOURS_SEMAINE.findIndex((j) => q.includes(j));
      if (jourNomme >= 0) jour = planning.jours.find((j) => j.jourSemaine === jourNomme) ?? null;
    }

  if (/\b(mets|met|mettre|ajoute|ajouter|cree|creer|programme|planifie|affecte|affecter|deplace|deplacer|annule|annuler|envoie|envoyer|previens|prevenir)\b/.test(q)) {
    return [
      {
        texte: `Pour que je puisse agir sur le planning ou envoyer des SMS${vocatif}, il faut activer mon intelligence avec une clé API Claude. En attendant, je peux vous lire le planning.`,
        carte: null,
      },
    ];
  }

  if (/^(bonjour|salut|hello|coucou|hey)\b/.test(q) && q.split(" ").length <= 3) {
    return [{ texte: `Bonjour${vocatif} ! Demandez-moi par exemple ce qui se passe aujourd'hui au planning.`, carte: null }];
  }

  if (q.includes("non affect") || q.includes("pas affect") || q.includes("sans operateur") || q.includes("personne")) {
    const rdvs = planning.jours.flatMap((j) =>
      j.rdvs.filter((r) => !r.operateurId).map((r) => ({ r, quand: quandOral(j, planning) }))
    );
    if (rdvs.length === 0) {
      return [{ texte: `Bonne nouvelle${vocatif} : tous les rendez-vous de la semaine ont un opérateur.`, carte:null }];
    }
    return [
      { texte: `Il y a ${rendezVous(rdvs.length)} sans opérateur cette semaine${vocatif}.`, carte: null },
      ...rdvs.map(({ r, quand }) => ({
        texte: majuscule(`${quand} à ${heureOrale(r.carte.heure)}, ${r.prestationOrale} au ${r.carte.adresse} à${r.carte.ville}, pour ${r.carte.client}.`),
        carte: r.carte,
          })),
          { texte: `Pensez à ${rdvs.length > 1 ? "les affecter" : "l'affecter"} depuis le planning.`, carte: null },
        ];
    }

  if (operateur) {
    const jours = jour ? [jour] : planning.jours;
    const rdvs = jours.flatMap((j) =>
      j.rdvs.filter((r) => r.operateurId === operateur.id).map((r) => ({ r, quand: quandOral(j, planning) }))
    );
    const periode = jour ? quandOral(jour, planning) : "cette semaine";
    if (rdvs.length === 0) {
      return [
        {
          texte: `${operateur.prenom} n'a aucun rendez-vous ${periode}. Ses horaires sont de ${operateur.horaires
            .split("–")
            .map(heureOrale)
            .join(" à ")}.`,
          carte: null,
        },
      ];
    }
    return [
      { texte: majuscule(`${periode}${vocatif}, ${operateur.prenom} a ${rendezVous(rdvs.length)}.`), carte: null},
      ...rdvs.map(({ r, quand }) => {
        const c = r.carte;
        return {
          texte: majuscule(`${jour ? "" : `${quand} `}à ${heureOrale(c.heure)}, ${r.prestationOrale} au ${c.adresse} à ${c.ville}, pour ${c.client}.`),
          carte: c,
        };
      }),
    ];
  }

  if (jour) {
    const quand = quandOral(jour, planning);
    if (jour.rdvs.length === 0) {
      return [{ texte: majuscule(`${quand}${vocatif}, il n'y a aucun rendez-vous au planning.`), carte: null }];
    }
    const libres = planning.operateurs.filter((o) => !jour.rdvs.some((r) => r.operateurId === o.id)).map((o) =>o.prenom);
    return [
      { texte: majuscule(`${quand}${vocatif}, il y a ${rendezVous(jour.rdvs.length)} au planning.`), carte: null},
      ...jour.rdvs.map((r) => phraseRdv(r, prenom)),
      ...(libres.length ? [{ texte: phraseSansRdv(libres, prenom, quand), carte: null }] : []),
    ];
  }

    // Récapitulatif de la semaine (question par défaut).
    const tous = planning.jours.flatMap((j) => j.rdvs.map((r) => ({ r, quand: quandOral(j, planning) })));
    if (tous.length === 0) {
      return [{ texte: `Le planning des 7 prochains jours est vide pour le moment${vocatif}.`, carte: null }];
    }
    const charge = planning.operateurs
      .map((o) => ({ o, n: tous.filter(({ r }) => r.operateurId === o.id).length }))
      .filter(({ n }) => n > 0)
      .map(({ o, n }) => `${o.prenom === prenom ? "vous" : o.prenom} ${nombre(n)}`);
    return [
      {
        texte: `Cette semaine${vocatif}, il y a ${rendezVous(tous.length)} au planning : ${enumerer(charge)}.`,
        carte: null,
      },
      ...tous.map(({ r, quand }) => phraseRdv(r, prenom, quand)),
    ];
}

export async function demanderLola(messages: MessageLola[], session: SessionPayload): Promise<ReponseLola> {
  const planning = await planningSemaine(session);
  if (process.env.ANTHROPIC_API_KEY) {
    return { ...(await repondreAvecClaude(messages, session, planning)), mode: "claude" };
  }
  const derniere = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return {
    segments: repondreLocalement(derniere, planning, await prenomInterlocuteur(session)),
    mode: "local",
    modifie: false,
      memoire: null,
    };
}

