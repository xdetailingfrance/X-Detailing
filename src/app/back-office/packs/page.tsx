import { redirect } from "next/navigation";
import { db, sansDecimal } from "@/lib/db";
import { listerPacksAvecTarifs } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import TarifGrid from "./TarifGrid";
import NouvelleOptionForm from "./NouvelleOptionForm";
import { plageDureeLisible } from "@/lib/heure";

export const dynamic = "force-dynamic";

// Moteur de tarification administrable — section 3 & 16 du cahier des
// charges. Modifier un tarif ici n'affecte jamais les RDV déjà créés (le
// prix est figé sur le RDV au moment de la réservation).
// Réservé au rôle OWNER (défense en profondeur, déjà filtré par le middleware).
export default async function PacksPage() {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "tarifs")) redirect("/back-office");

  const packs = await listerPacksAvecTarifs();
  const options = sansDecimal(await db.option.findMany({ orderBy: [{ groupe: "asc" }, { ordre: "asc" }, { nom: "asc" }] }));

   return (
     <div className="flex flex-col gap-8">
       <div>
         <h1 className="text-xl md:text-2xl font-semibold">Packs &amp; Tarifs</h1>
         <p className="text-[var(--muted)] text-sm mt-1">
           Grille de prix par catégorie de véhicule. Une case vide signifie « à paramétrer ».
         </p>
       </div>

        <div className="flex flex-col gap-4">
        {packs.map((pack) => (
          <div key={pack.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
            <div>
              <h2 className="font-medium">{pack.nom}</h2>
              <p className="text-[var(--muted)] text-xs mt-0.5">
                {pack.description} · Durée visible : {plageDureeLisible(pack.dureeMinMinutes, pack.dureeMaxMinutes)}
              </p>
            </div>
            <TarifGrid
              packId={pack.id}
              tarifs={pack.tarifs.map((t) => ({ categorie: t.categorie, prix: t.prix.toString() }))}
            />
          </div>
        ))}
      </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Options</h2>
          <NouvelleOptionForm />
          <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
                <tr>
                  <th className="px-4 py-2">Nom</th>
                  <th className="px-4 py-2">Prix</th>
                </tr>
              </thead>
              <tbody>
                {options.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-[var(--muted)]">
                      Aucune option pour le moment.
                    </td>
                  </tr>
                )}
                {options.map((o) => (
                  <tr key={o.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2">{o.nom}</td>
                    <td className="px-4 py-2">{o.prix.toString()} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
}

