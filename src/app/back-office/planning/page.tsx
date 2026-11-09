import Link from "next/link";
import { db } from "@/lib/db";
import { dateParis, debutSemaineParis, decalerJour, formatParis, jourParis } from "@/lib/heure";
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

type Rdv = Awaited<ReturnType<typeof listerRendezVousAvecRelations>>[number];

/**
 * Planning. La semaine est la vue par défaut : une journée seule ne dit pas
 * si la tournée de jeudi est tenable, ni où placer un report. Le jour reste
 * accessible pour le détail par opérateur.
 */
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; vue?: string }>;
}) {
  const params = await searchParams;
  const aujourdhui = jourParis(new Date());
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : aujourdhui;
  const vueJour = params.vue === "jour";

  const debut = vueJour ? date : jourParis(debutSemaineParis(dateParis(date, "12:00")));
  const nbJours = vueJour ? 1 : 7;
  const fin = decalerJour(debut, nbJours);

  const rendezVous = await listerRendezVousAvecRelations({
    dateHeure: { gte: dateParis(debut), lt: dateParis(fin) },
  });
  const operateurs = await db.operateur.findMany({ where: { statut: "ACTIF" }, orderBy: { nom: "asc" } });

  const jours = Array.from({ length: nbJours }, (_, i) => decalerJour(debut, i));
  const lien = (d: string) => `/back-office/planning?date=${d}${vueJour ? "&vue=jour" : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Planning</h1>
          <p className="text-[var(--muted)] text-sm mt-1 first-letter:uppercase">
            {vueJour
              ? formatParis(dateParis(date, "12:00"), { weekday: "long", day: "numeric", month: "long" })
              : `Semaine du ${formatParis(dateParis(debut, "12:00"), { weekday: "long", day: "numeric", month: "long" })}`}
            {" · "}
            {rendezVous.length} rendez-vous
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={lien(decalerJour(debut, -nbJours))} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 hover:bg-[var(--surface-2)]">
            ←
          </Link>
          <Link href={lien(aujourdhui)} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 hover:bg-[var(--surface-2)]">
            Aujourd&apos;hui
          </Link>
          <Link href={lien(decalerJour(debut, nbJours))} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 hover:bg-[var(--surface-2)]">
            →
          </Link>
          <Link
            href={`/back-office/planning?date=${date}${vueJour ? "" : "&vue=jour"}`}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 hover:bg-[var(--surface-2)]"
          >
            {vueJour ? "Vue semaine" : "Vue jour"}
          </Link>
        </div>
      </div>

      {vueJour ? (
        <ParOperateur rendezVous={rendezVous} operateurs={operateurs} />
      ) : (
        /* Téléphone : les jours s'empilent ; ordinateur : sept colonnes. */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {jours.map((j) => {
            const duJour = rendezVous
              .filter((r) => jourParis(r.dateHeure) === j)
              .sort((a, b) => a.dateHeure.getTime() - b.dateHeure.getTime());
            return (
              <div
                key={j}
                className={`rounded-lg border bg-[var(--surface)] flex flex-col ${
                  j === aujourdhui ? "border-[var(--accent)]" : "border-[var(--border)]"
                }`}
              >
                <div className="px-3 py-2 border-b border-[var(--border)] text-sm">
                  <span className="font-medium first-letter:uppercase">
                    {formatParis(dateParis(j, "12:00"), { weekday: "short" })}
                  </span>{" "}
                  <span className="text-[var(--muted)]">
                    {formatParis(dateParis(j, "12:00"), { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-[var(--border)]">
                  {duJour.length === 0 && <p className="px-3 py-3 text-xs text-[var(--muted)]">—</p>}
                  {duJour.map((r) => (
                    <Carte key={r.id} rdv={r} avecOperateur />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ParOperateur({ rendezVous, operateurs }: { rendezVous: Rdv[]; operateurs: { id: string; prenom: string; nom: string }[] }) {
  const parOperateur = new Map<string, Rdv[]>();
  parOperateur.set("__non_affecte__", []);
  for (const op of operateurs) parOperateur.set(op.id, []);
  for (const r of rendezVous) {
    const cle = r.operateurId ?? "__non_affecte__";
    if (!parOperateur.has(cle)) parOperateur.set(cle, []);
    parOperateur.get(cle)!.push(r);
  }

  return (
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
              {rdvs.length === 0 && <p className="px-3 py-3 text-xs text-[var(--muted)]">Aucun RDV</p>}
              {rdvs
                .sort((a, b) => a.dateHeure.getTime() - b.dateHeure.getTime())
                .map((r) => (
                  <Carte key={r.id} rdv={r} />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Carte({ rdv, avecOperateur }: { rdv: Rdv; avecOperateur?: boolean }) {
  return (
    <Link
      href={`/back-office/rendez-vous/${rdv.id}`}
      className="px-3 py-2 text-xs hover:bg-[var(--surface-2)] flex flex-col gap-0.5"
    >
      <span className="font-medium">
        {formatParis(rdv.dateHeure, { hour: "2-digit", minute: "2-digit" })} — {rdv.client.prenom} {rdv.client.nom}
      </span>
      <span className="text-[var(--muted)]">
        {rdv.pack.nom} · {rdv.adresse.ville}
      </span>
      {avecOperateur && (
        <span className="text-[var(--muted)]">
          {rdv.operateur ? `${rdv.operateur.prenom} ${rdv.operateur.nom}` : "non affecté"}
        </span>
      )}
      <span className="text-[var(--muted)]">{LIBELLE_STATUT[rdv.statut]}</span>
    </Link>
  );
}
