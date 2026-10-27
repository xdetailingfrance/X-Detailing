import Link from "next/link";
import { listerDevisAvecRelations } from "@/lib/queries";
import type { StatutDevis } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLONNES: { statut: StatutDevis; titre: string }[] = [
  { statut: "BROUILLON", titre: "Brouillon" },
  { statut: "ENVOYE", titre: "Envoyé" },
  { statut: "CONSULTE", titre: "Consulté" },
  { statut: "ACCEPTE", titre: "Accepté" },
  { statut: "ACOMPTE_PAYE", titre: "Acompte payé" },
  { statut: "RDV_CREE", titre: "RDV créé" },
];

// Pipeline commercial — accessible au Commercial et au OWNER (jamais à un
// compte purement OPERATEUR, cantonné à /operateur par le middleware).
// Aucune donnée financière globale (CA/commissions) n'apparaît ici : le
// prix d'un devis est une information de vente au même titre que celle
// déjà visible lors de la création d'un RDV, pas une donnée d'entreprise.
export default async function DevisPipelinePage() {
  const devis = await listerDevisAvecRelations();

   return (
     <div className="flex flex-col gap-6">
       <div className="flex flex-wrap items-center justify-between gap-3">
         <h1 className="text-xl md:text-2xl font-semibold">Devis</h1>
         <Link
           href="/back-office/devis/nouveau"
                 className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent-2)] transition"
             >
            Nouveau devis
          </Link>
        </div>

      {/* Pipeline : défilement horizontal (colonne par colonne sur téléphone). */}
      <div
        className="-mx-4 grid snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
        style={{ gridTemplateColumns: `repeat(${COLONNES.length}, minmax(240px, 1fr))` }}
      >
        {COLONNES.map(({ statut, titre }) => {
          const items = devis.filter((d) => d.statut === statut);
          return (
            <div key={statut} className="snap-start rounded-lg border border-[var(--border)] bg-[var(--surface)]flex flex-col">
              <div className="px-3 py-2 border-b border-[var(--border)] font-medium text-sm flex items-center justify-between">
                <span>{titre}</span>
                <span className="text-[var(--muted)]">{items.length}</span>
              </div>
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {items.length === 0 && <p className="px-3 py-3 text-xs text-[var(--muted)]">Aucun devis</p>}
                {items.map((d) => (
                  <Link
                    key={d.id}
                    href={`/back-office/devis/${d.id}`}
                    className="px-3 py-2 text-xs hover:bg-[var(--surface-2)] flex flex-col gap-0.5"
                  >
                    <span className="font-medium">{d.nomClient}</span>
                    <span className="text-[var(--muted)]">
                      {d.pack.nom} · {d.prixTotal} €
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

