import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { listerRendezVousAvecRelations } from "@/lib/queries";
import { dateParis, decalerJour, dureeLisible, formatParis } from "@/lib/heure";
import { db } from "@/lib/db";
import { SOURCES } from "@/lib/indicateurs";
import { titrePrestation } from "@/lib/prestationsPubliques";
import { EnTete, euros } from "@/components/backoffice/ui";
import type { SourceRendezVous, StatutRendezVous } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUTS: { valeur: StatutRendezVous; libelle: string }[] = [
  { valeur: "EN_ATTENTE", libelle: "En attente" },
  { valeur: "CONFIRME", libelle: "Confirmé" },
  { valeur: "EN_ROUTE", libelle: "En route" },
  { valeur: "CONTROLE", libelle: "Contrôle & signature" },
  { valeur: "PHOTOS_AVANT", libelle: "Photos avant" },
  { valeur: "LAVAGE", libelle: "Prestation en cours" },
  { valeur: "PHOTOS_APRES", libelle: "Photos après" },
  { valeur: "PAIEMENT", libelle: "Paiement" },
  { valeur: "TERMINE", libelle: "Terminé" },
  { valeur: "ANNULE", libelle: "Annulé" },
];
const LIBELLE = Object.fromEntries(STATUTS.map((s) => [s.valeur, s.libelle]));
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

type Params = { statut?: string; operateur?: string; source?: string; du?: string; au?: string; q?: string };

// Toutes les réservations, filtrables (statut, opérateur, source, dates,
// recherche client).
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const q = p.q?.trim();
  const where: Prisma.RendezVousWhereInput = {
    statut: STATUTS.some((s) => s.valeur === p.statut) ? (p.statut as StatutRendezVous) : undefined,
    operateurId: p.operateur === "aucun" ? null : p.operateur || undefined,
    source: SOURCES.some((s) => s.valeur === p.source) ? (p.source as SourceRendezVous) : undefined,
    dateHeure: {
      gte: p.du && JOUR.test(p.du) ? dateParis(p.du) : undefined,
      lt: p.au && JOUR.test(p.au) ? dateParis(decalerJour(p.au, 1)) : undefined,
    },
    client: q
      ? {
          OR: [
            { nom: { contains: q, mode: "insensitive" } },
            { prenom: { contains: q, mode: "insensitive" } },
            { telephone: { contains: q.replace(/\D/g, "").slice(-4) || q } },
          ],
        }
      : undefined,
  };
  const [rdvs, operateurs] = await Promise.all([
    listerRendezVousAvecRelations(where),
    db.operateur.findMany({ orderBy: { prenom: "asc" } }),
  ]);
  const liste = rdvs.slice(-300).reverse();

  return (
    <div className="flex flex-col gap-6">
      <EnTete
        titre="Réservations"
        sousTitre={`${rdvs.length} réservation${rdvs.length > 1 ? "s" : ""}${rdvs.length > 300 ? " (300 plus récentes affichées)" : ""}`}
        actions={
          <Link href="/back-office/rendez-vous/nouveau" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-2)]">
            + Nouvelle réservation
          </Link>
        }
      />
      <form method="get" className="bo-panneau flex flex-wrap items-end gap-3 rounded-2xl p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Client</span>
          <input name="q" defaultValue={q} placeholder="Nom ou téléphone" className="bo-champ" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Statut</span>
          <select name="statut" defaultValue={p.statut ?? ""} className="bo-champ">
            <option value="">Tous</option>
            {STATUTS.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Opérateur</span>
          <select name="operateur" defaultValue={p.operateur ?? ""} className="bo-champ">
            <option value="">Tous</option>
            <option value="aucun">Sans opérateur</option>
            {operateurs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.prenom} {o.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Source</span>
          <select name="source" defaultValue={p.source ?? ""} className="bo-champ">
            <option value="">Toutes</option>
            {SOURCES.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Du</span>
          <input type="date" name="du" defaultValue={p.du} className="bo-champ" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Au</span>
          <input type="date" name="au" defaultValue={p.au} className="bo-champ" />
        </label>
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white hover:bg-[var(--accent-2)]">
          Filtrer
        </button>
      </form>

      <div className="bo-panneau overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Adresse</th>
              <th className="px-4 py-3 font-medium">Prestation</th>
              <th className="px-4 py-3 font-medium text-right">Prix</th>
              <th className="px-4 py-3 font-medium">Opérateur</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {liste.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucune réservation ne correspond à ces filtres.
                </td>
              </tr>
            )}
            {liste.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)] align-top hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <a href={`/back-office/rendez-vous/${r.id}`} className="font-medium hover:text-[var(--accent-clair)]">
                    {formatParis(r.dateHeure, { weekday: "short", day: "numeric", month: "short" })}
                  </a>
                  <p className="text-xs text-[var(--muted)]">{formatParis(r.dateHeure, { hour: "2-digit", minute:"2-digit" })}</p>
                </td>
                <td className="px-4 py-2.5">
                  {r.client.prenom} {r.client.nom}
                  <p className="text-xs">
                    <a href={`tel:${r.client.telephone.replace(/\s/g, "")}`} className="text-[var(--accent-clair)] hover:underline">
                      {r.client.telephone}
                    </a>
                  </p>
                </td>
                <td className="px-4 py-2.5 text-[var(--muted)]">
                  {r.adresse.adresse}, {r.adresse.ville}
                </td>
                <td className="px-4 py-2.5">
                  {titrePrestation(r.pack.id, r.pack.nom)}
                  <p className="text-xs text-[var(--muted)]">{dureeLisible(r.dureeMinutes)}</p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {euros(r.prixTotal, 2)}
                  {r.acompteStatut === "PAYE" && <p className="text-xs text-[var(--success)]">acompte payé</p>}
                </td>
                <td className="px-4 py-2.5">{r.operateur ? `${r.operateur.prenom} ${r.operateur.nom}` : <span className="text-[var(--warning)]">À affecter</span>}</td>
                <td className="px-4 py-2.5">{LIBELLE[r.statut] ?? r.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    );
}

