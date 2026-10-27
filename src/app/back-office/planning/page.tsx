import Link from "next/link";
import { db } from "@/lib/db";
import { dateParis, decalerJour, formatParis, jourParis } from "@/lib/heure";
import { listerRendezVousAvecRelations } from "@/lib/queries";

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

const decaler = decalerJour;

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : jourParis(new Date());

  const rendezVous = await listerRendezVousAvecRelations({ dateHeure: { gte: dateParis(date), lt: dateParis(decalerJour(date, 1)) } });
  const operateurs = await db.operateur.findMany({ where: { statut: "ACTIF" }, orderBy: { nom: "asc" } });

   const parOperateur = new Map<string, typeof rendezVous>();
   parOperateur.set("__non_affecte__", []);
   for (const op of operateurs) parOperateur.set(op.id, []);
   for (const r of rendezVous) {
     const cle = r.operateurId ?? "__non_affecte__";
     if (!parOperateur.has(cle)) parOperateur.set(cle, []);
     parOperateur.get(cle)!.push(r);
   }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-semibold">Planning global</h1>
        <div className="flex w-full items-center justify-between gap-2 text-sm sm:w-auto">
          <Link
            href={`/back-office/planning?date=${decaler(date, -1)}`}
            className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-3 py-1 hover:bg-[var(--surface-2)]"
          >
            ← Veille
          </Link>
          <span className="px-2 text-center first-letter:uppercase">{formatParis(dateParis(date, "12:00"), { weekday: "long", day: "numeric", month: "long" })}</span>
          <Link
            href={`/back-office/planning?date=${decaler(date, 1)}`}
            className="rounded-md bg-[var(--surface)] border border-[var(--border)] px-3 py-1 hover:bg-[var(--surface-2)]"
          >
            Lendemain →
          </Link>
        </div>
      </div>

      {/* Téléphone : un opérateur sous l'autre ; ordinateur : une colonne par opérateur. */}
      <div
        className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--colonnes),minmax(220px,1fr))] md:overflow-x-auto"
        style={{ "--colonnes": parOperateur.size } as React.CSSProperties}
      >
        {[...parOperateur.entries()].map(([cle, rdvs]) => {
          const operateur = operateurs.find((o) => o.id === cle);
          return (
            <div key={cle} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] flex flex-col">
              <div className="px-3 py-2 border-b border-[var(--border)] font-medium text-sm">
                {operateur ? `${operateur.prenom} ${operateur.nom}` : "Non affectés"}
              </div>
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {rdvs.length === 0 && (
                   <p className="px-3 py-3 text-xs text-[var(--muted)]">Aucun RDV</p>
                )}
                {rdvs
                   .sort((a, b) => a.dateHeure.getTime() - b.dateHeure.getTime())
                   .map((r) => (
                     <Link
                       key={r.id}
                       href={`/back-office/rendez-vous/${r.id}`}
                       className="px-3 py-2 text-xs hover:bg-[var(--surface-2)] flex flex-col gap-0.5"
                     >
                       <span className="font-medium">
                         {formatParis(r.dateHeure, { hour: "2-digit", minute: "2-digit" })}{" "}
                         — {r.client.prenom} {r.client.nom}
                       </span>
                       <span className="text-[var(--muted)]">
                         {r.pack.nom} · {r.adresse.ville}
                        </span>
                        <span className="text-[var(--muted)]">{LIBELLE_STATUT[r.statut]}</span>
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

