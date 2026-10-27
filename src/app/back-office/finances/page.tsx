import { redirect } from "next/navigation";
import { db, sansDecimal } from "@/lib/db";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { debutJourParis, debutMoisParis, debutSemaineParis, moisParis } from "@/lib/heure";
import DepensesForm from "./DepensesForm";

export const dynamic = "force-dynamic";

const TAUX_COMMISSION = 0.18; // commission réseau X Detailing

// Page strictement réservée au rôle OWNER — règle absolue n°16 du cahier
// des charges (CA, commissions, marge jamais visibles du Commercial ou de
// l'Opérateur). Défense en profondeur : déjà filtré par le middleware.
export default async function FinancesPage() {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "finances")) redirect("/back-office");

    const maintenant = new Date();
    const debutsPeriodes = {
      jour: debutJourParis(maintenant),
      semaine: debutSemaineParis(maintenant),
      mois: debutMoisParis(maintenant),
    };

    const rdvMois = sansDecimal(
      await db.rendezVous.findMany({
        where: { statut: { not: "ANNULE" }, dateHeure: { gte: debutsPeriodes.mois } },
        include: { operateur: true },
      })
    );

    function sommer(depuis: Date) {
      return rdvMois.filter((r) => r.dateHeure >= depuis).reduce((total, r) => total + r.prixTotal, 0);
    }

  const caJour = sommer(debutsPeriodes.jour);
  const caSemaine = sommer(debutsPeriodes.semaine);
  const caMois = sommer(debutsPeriodes.mois);
  // Seuls les acomptes validés par Stripe sont comptés comme encaissés.
  const acomptesEncaissesMois = rdvMois.filter((r) => r.acompteStatut === "PAYE").reduce((total, r) => total + r.acompte, 0);
  const resteAEncaisserMois = caMois - acomptesEncaissesMois;
  const commissionMois = caMois * TAUX_COMMISSION;
  const depenses = sansDecimal(await db.depensesMensuelles.findUnique({ where: { mois: moisParis(maintenant) }})) ?? { depenses: 0, publicite: 0 };

  const parOperateur = new Map<string, { nom: string; ca: number; nb: number }>();
  for (const r of rdvMois) {
    if (!r.operateurId) continue;
    const operateur = r.operateur;
    if (!operateur) continue;
    const entree = parOperateur.get(operateur.id) ?? { nom: `${operateur.prenom} ${operateur.nom}`, ca: 0, nb: 0};
    entree.ca += r.prixTotal;
    entree.nb += 1;
    parOperateur.set(operateur.id, entree);
  }

    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Finances</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Réservé à la Direction — visible uniquement par le rôle OWNER.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Carte titre="CA réservé du jour" valeur={`${caJour.toFixed(0)} €`} />
          <Carte titre="CA réservé de la semaine" valeur={`${caSemaine.toFixed(0)} €`} />
          <Carte titre="CA réservé du mois" valeur={`${caMois.toFixed(0)} €`} />
          <Carte titre="Commission X Detailing (18 %, mois)" valeur={`${(caMois * TAUX_COMMISSION).toFixed(0)} €`}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Carte titre="Acomptes payés en ligne (mois)" valeur={`${acomptesEncaissesMois.toFixed(2)} €`} />
          <Carte titre="Reste à encaisser (mois, estimation)" valeur={`${resteAEncaisserMois.toFixed(2)} €`} />
        </div>

        <div>
          <h2 className="text-lg font-medium mb-3">CA par opérateur (mois en cours)</h2>
          <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
                <tr>
                  <th className="px-4 py-2">Opérateur</th>
                  <th className="px-4 py-2">RDV</th>
                  <th className="px-4 py-2">CA</th>
                  <th className="px-4 py-2">Commission réseau (18 %)</th>
                </tr>
              </thead>
              <tbody>
                {parOperateur.size === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)]">
                      Aucune donnée ce mois-ci.
                    </td>
                  </tr>
                )}
                {[...parOperateur.values()]
                  .sort((a, b) => b.ca - a.ca)
                  .map((o) => (
                    <tr key={o.nom} className="border-t border-[var(--border)]">
                      <td className="px-4 py-2">{o.nom}</td>
                      <td className="px-4 py-2">{o.nb}</td>
                      <td className="px-4 py-2">{o.ca.toFixed(0)} €</td>
                      <td className="px-4 py-2">{(o.ca * TAUX_COMMISSION).toFixed(0)} €</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium mb-3">Dépenses & marge nette (mois en cours)</h2>
          <DepensesForm
            depensesInitiales={depenses.depenses}
            publiciteInitiale={depenses.publicite}
            commissionMois={commissionMois}
          />
        </div>

        <p className="text-xs text-[var(--muted)]">
          La marge nette ci-dessus est une estimation (commission réseau − dépenses fixes − publicité) : les
          impayés et l&apos;historisation détaillée des versions de prix ne sont pas encore couverts.
        </p>
      </div>
    );
}

function Carte({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--muted)] uppercase tracking-wide">{titre}</p>
      <p className="text-2xl font-semibold mt-1">{valeur}</p>
    </div>
  );
}

