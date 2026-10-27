import { db } from "@/lib/db";
import { listerRendezVousAvecRelations } from "@/lib/queries";
import { debutJourParis, finJourParis, formatParis } from "@/lib/heure";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { prenomInterlocuteur } from "@/lib/lola";
import {
  indicateurs,
  serieCA,
  SOURCES,
  type Filtres,
  type Granularite,
  type Periode,
} from "@/lib/indicateurs";
import { titrePrestation } from "@/lib/prestationsPubliques";
import LolaAccueil from "@/components/lola/LolaAccueil";
import GraphiqueCA from "@/components/backoffice/GraphiqueCA";
import Repliable from "@/components/backoffice/Repliable";
import {
  EnTete,
  Panneau,
  Section,
  Stat,
  euros,
} from "@/components/backoffice/ui";
import type { SourceRendezVous } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIBELLE_STATUT: Record<string, string> = {
  EN_ATTENTE: "En attente",
  CONFIRME: "Confirmé",
  EN_ROUTE: "En route",
  ARRIVE: "Arrivé",
  CONTROLE: "Contrôle & signature",
  PHOTOS_AVANT: "Photos avant",
  LAVAGE: "Prestation en cours",
  PHOTOS_APRES: "Photos après",
  PAIEMENT: "Paiement",
  EN_COURS: "En cours",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

const PERIODES: { valeur: Periode; libelle: string }[] = [
  { valeur: "jour", libelle: "Aujourd'hui" },
  { valeur: "semaine", libelle: "Cette semaine" },
  { valeur: "mois", libelle: "Ce mois" },
  { valeur: "annee", libelle: "Cette année" },
  { valeur: "personnalisee", libelle: "Personnalisée" },
];

type Params = {
  periode?: string;
  du?: string;
  au?: string;
  operateur?: string;
  prestation?: string;
  source?: string;
  graphique?: string;
};

// Vue d'ensemble : la situation de X Detailing en un coup d'œil. Les
// montants ne sont visibles qu'avec la permission « finances ».
export default async function VueEnsemblePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const finances = !!session && aLaPermission(session.role, "finances");

   const filtres: Filtres = {
     periode: PERIODES.some((p) => p.valeur === params.periode)
       ? (params.periode as Periode)
       : "mois",
     du: params.du,
     au: params.au,
     operateurId: params.operateur || undefined,
     packId: params.prestation || undefined,
     source: SOURCES.some((s) => s.valeur === params.source)
       ? (params.source as SourceRendezVous)
       : undefined,
   };
   const granularite: Granularite =
     params.graphique === "semaine" || params.graphique === "annee"
       ? params.graphique
       : "mois";

   const maintenant = new Date();
   const [k, serie, operateurs, packs, rdvDuJour, prenom] = await Promise.all([
     indicateurs(filtres),
     finances ? serieCA(granularite, filtres) : Promise.resolve([]),
     db.operateur.findMany({ orderBy: { prenom: "asc" } }),
     db.pack.findMany({ orderBy: { createdAt: "asc" } }),
     listerRendezVousAvecRelations({
       dateHeure: {
         gte: debutJourParis(maintenant),
         lt: finJourParis(maintenant),
       },
     }),
     session ? prenomInterlocuteur(session) : null,
   ]);

   const lien = (changements: Partial<Params>) => {
     const p = new URLSearchParams(
       Object.entries({ ...params, ...changements }).filter(([, v]) => v) as [
         string,
         string,
       ][],
     );
     return `/back-office?${p.toString()}`;
   };
   const margeEstimee =
     k.caRealise -
      (filtres.periode === "mois" ? k.depensesMois + k.publiciteMois : 0);

   return (
     <div className="flex flex-col gap-8">
       <EnTete
         titre={prenom ? `Bonjour ${prenom}` : "Vue d'ensemble"}
         sousTitre={
           <span className="first-letter:uppercase">
             {formatParis(maintenant, {
               weekday: "long",
               day: "numeric",
               month: "long",
               year: "numeric",
             })}
           </span>
         }
       />

        {/* Filtres : une seule ligne au-dessus des indicateurs (repliés sur téléphone) */}
        <Repliable libelle={`Filtres · ${k.periode.libelle}`}>
          <form
            method="get"
            className="bo-panneau flex flex-wrap items-end gap-3 rounded-2xl p-3 text-sm"
          >
            <Champ libelle="Période">
              <select
                name="periode"
                defaultValue={filtres.periode}
                className="bo-champ"
              >
                {PERIODES.map((p) => (
                  <option key={p.valeur} value={p.valeur}>
                    {p.libelle}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Du">
              <input
                type="date"
                name="du"
                defaultValue={params.du}
                className="bo-champ"
              />
            </Champ>
            <Champ libelle="Au">
              <input
                type="date"
                name="au"
                defaultValue={params.au}
                className="bo-champ"
              />
            </Champ>
            <Champ libelle="Opérateur">
              <select
                name="operateur"
                defaultValue={params.operateur ?? ""}
                className="bo-champ"
              >
                <option value="">Tous</option>
                {operateurs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.prenom} {o.nom}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ libelle="Prestation">
              <select
                name="prestation"
                defaultValue={params.prestation ?? ""}
                className="bo-champ"
              >
                <option value="">Toutes</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {titrePrestation(p.id, p.nom)}
                  </option>
                ))}
            </select>
          </Champ>
          <Champ libelle="Source">
            <select
              name="source"
              defaultValue={params.source ?? ""}
              className="bo-champ"
            >
              <option value="">Toutes</option>
              {SOURCES.map((s) => (
                <option key={s.valeur} value={s.valeur}>
                  {s.libelle}
                </option>
              ))}
            </select>
          </Champ>
          {params.graphique && (
            <input type="hidden" name="graphique" value={params.graphique} />
          )}
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white transition hover:bg-[var(--accent-2)]"
          >
            Appliquer
          </button>
        </form>
      </Repliable>

      {finances && (
        <Section
          titre={`Argent — ${k.periode.libelle}`}
          aide="Réservé = prévu · Réalisé = prestations clôturées · Encaissé = validé par Stripe"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              titre="CA réservé"
              valeur={euros(k.caReserve)}
              detail={`${k.nbReservations} réservation${k.nbReservations > 1 ? "s" : ""}`}
            />
            <Stat
              titre="CA réalisé"
              valeur={euros(k.caRealise)}
              detail={`${k.nbTermines} prestation${k.nbTermines > 1 ? "s" : ""} clôturée${k.nbTermines > 1 ? "s": ""}`}
              ton="accent"
            />
            <Stat
              titre="Encaissé vérifié"
              valeur={euros(k.encaisseVerifie, 2)}
              detail="Acomptes payés par Stripe"
            />
            <Stat
              titre="Espèces déclarées"
              valeur={euros(k.declareEspeces, 2)}
              detail="Par les opérateurs, à contrôler"
            />
            <Stat
              titre="Carte déclarée"
              valeur={euros(k.declareCarte, 2)}
              detail="Sans confirmation du prestataire"
            />
            <Stat
              titre="Reste à recevoir"
              valeur={euros(k.resteARecevoir, 2)}
              detail="Sur les prestations clôturées"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              titre="Dépenses du mois"
              valeur={euros(k.depensesMois + k.publiciteMois)}
              detail={`dont publicité ${euros(k.publiciteMois)} · saisies`}
              href="/back-office/finances"
            />
            <Stat
              titre="Résultat estimé"
              valeur={filtres.periode === "mois" ? euros(margeEstimee) : "—"}
              detail={
                 filtres.periode === "mois"
                   ? "CA réalisé − dépenses saisies"
                   : "Disponible sur la période « Ce mois »"
                }
                ton="estimation"
              />
              <Stat
                titre="Coût pub / réservation"
                valeur={
                  k.coutPubParReservation != null
                    ? euros(k.coutPubParReservation, 2)
                    : "—"
                }
                detail="Budget saisi ÷ réservations du mois"
                ton="estimation"
              />
              <Stat
                titre="Trésorerie"
                valeur="Banque non connectée"
                detail="Disponible après connexion bancaire"
                ton="indisponible"
              />
            </div>
          </Section>
        )}

        <Section titre="Activité">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              titre="Réservations aujourd'hui"
              valeur={String(k.rdvJour)}
              href="/back-office/planning"
            />
            <Stat
              titre="Prestations à venir"
              valeur={String(k.aVenir)}
              href="/back-office/reservations"
            />
            <Stat
              titre="Sans opérateur"
              valeur={String(k.enAttente)}
              detail="Clients en attente d'affectation"
              href="/back-office/reservations?statut=EN_ATTENTE"
              ton={k.enAttente ? "accent" : "normal"}
            />
            <Stat
              titre="Opérateurs actifs"
              valeur={String(k.operateursActifs)}
              href="/back-office/operateurs"
            />
            <Stat
              titre="Prestations terminées"
              valeur={String(k.nbTermines)}
              detail={k.periode.libelle}
            />
            <Stat
              titre="Devis envoyés"
              valeur={String(k.devisEnvoyes)}
              detail={k.periode.libelle}
              href="/back-office/devis"
            />
            <Stat
              titre="Transformation des devis"
              valeur={
                k.tauxTransformation != null ? `${k.tauxTransformation} %` : "—"
              }
              detail="Devis envoyés devenus réservation"
            />
            <Stat
              titre="Leads Meta"
              valeur="Meta non connecté"
              detail="Voir Leads Meta Ads"
              href="/back-office/leads"
              ton="indisponible"
            />
          </div>
        </Section>

        {finances && (
        <Panneau>
          <div className="mb-3 flex gap-2 text-xs">
            {(["semaine", "mois", "annee"] as Granularite[]).map((g) => (
              <a
                key={g}
                href={lien({ graphique: g })}
                className={`rounded-full border px-3 py-1 ${granularite === g ? "border-[var(--accent)] text-[var(--accent-clair)]" : "border-[var(--border)] text-[var(--muted)]"}`}
              >
                {g === "semaine"
                  ? "12 semaines"
                  : g === "mois"
                    ? "12 mois"
                    : "5 ans"}
              </a>
            ))}
          </div>
          <GraphiqueCA
            points={serie}
            titre="Chiffre d'affaires réservé et réalisé"
          />
        </Panneau>
      )}

        <Section titre="Rendez-vous du jour">
          <div className="bo-panneau overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Heure</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Prestation</th>
                  <th className="px-4 py-3 font-medium">Opérateur</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rdvDuJour.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-[var(--muted)]"
                    >
                      Aucun rendez-vous aujourd&apos;hui.
                    </td>
                  </tr>
                )}
                {rdvDuJour.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--border)] hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-2.5 tabular-nums">
                      <a
                        href={`/back-office/rendez-vous/${r.id}`}
                        className="hover:text-[var(--accent-clair)]"
                      >
                        {formatParis(r.dateHeure, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </a>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.client.prenom} {r.client.nom}
                    </td>
                    <td className="px-4 py-2.5">
                      {titrePrestation(r.pack.id, r.pack.nom)}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.operateur
                        ? `${r.operateur.prenom} ${r.operateur.nom}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {LIBELLE_STATUT[r.statut] ?? r.statut}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {session && aLaPermission(session.role, "lola") && (
          <Section titre="Lola">
            <LolaAccueil prenom={prenom} />
          </Section>
        )}
      </div>
    );
}

function Champ({
  libelle,
  children,
}: {
  libelle: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
        {libelle}
      </span>
      {children}
    </label>
  );
}

