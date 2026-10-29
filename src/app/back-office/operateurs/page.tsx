import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import NouvelOperateurForm from "./NouvelOperateurForm";
import StatutToggle from "./StatutToggle";
import HorairesForm from "./HorairesForm";
import DomicileForm from "./DomicileForm";

export const dynamic = "force-dynamic";

// Réservé au rôle OWNER (défense en profondeur, déjà filtré par le middleware).
export default async function OperateursPage() {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "operateurs")) redirect("/back-office");

  const operateurs = await db.operateur.findMany({ include: { secteur: true }, orderBy: [{ statut: "asc" }, { nom: "asc" }] });
  const secteurs = await db.secteur.findMany({ orderBy: { nom: "asc" } });

    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-xl md:text-2xl font-semibold">Opérateurs</h1>

         <NouvelOperateurForm secteurs={secteurs} />

        <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
              <tr>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Secteur</th>
                <th className="px-4 py-2">Domicile (départ des trajets)</th>
                <th className="px-4 py-2">Horaires</th>
                <th className="px-4 py-2">Kangoo</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {operateurs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--muted)]">
                    Aucun opérateur pour le moment.
                  </td>
                </tr>
              )}
              {operateurs.map((op) => (
                <tr key={op.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">
                    {op.prenom} {op.nom}
                  </td>
                  <td className="px-4 py-2">{op.secteur?.nom ?? "—"}</td>
                  <td className="px-4 py-2 align-top">
                    <DomicileForm
                      operateurId={op.id}
                      adresseDomicile={op.adresseDomicile}
                      geocode={op.latitudeDomicile != null && op.longitudeDomicile != null}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <HorairesForm operateurId={op.id} heureDebut={op.heureDebut} heureFin={op.heureFin} />
                  </td>
                  <td className="px-4 py-2">{op.kangooImmatriculation ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        op.statut === "ACTIF" ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }
                    >
                      {op.statut === "ACTIF" ? "Actif" : "Suspendu"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <StatutToggle operateurId={op.id} statut={op.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
}

