import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { formatParis } from "@/lib/heure";

export const dynamic = "force-dynamic";

// Piste d'audit des actions sensibles (lecture seule : rien n'y est jamais
// modifié ni supprimé). Réservé au directeur.
export default async function JournalAuditPage({ searchParams }: { searchParams: Promise<{ entite?: string }> }){
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "audit")) redirect("/back-office");
  const { entite } = await searchParams;

  const entrees = await db.journalAudit.findMany({
    where: entite ? { entite } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const entites = await db.journalAudit.findMany({ distinct: ["entite"], select: { entite: true }, orderBy: { entite: "asc" } });

   return (
     <div className="flex flex-col gap-6">
       <div>
         <h1 className="text-xl md:text-2xl font-semibold">Journal d&apos;audit</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Actions sensibles (connexions, paiements, tarifs, affectations, annulations…), les 300 plus récentes.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <a href="/back-office/journal" className={`rounded-full border px-3 py-1 ${!entite ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)]"}`}>
          Tout
        </a>
        {entites.map((e) => (
          <a
            key={e.entite}
            href={`/back-office/journal?entite=${encodeURIComponent(e.entite)}`}
            className={`rounded-full border px-3 py-1 ${entite === e.entite ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)]"}`}
          >
            {e.entite}
          </a>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Auteur</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Élément</th>
              <th className="px-4 py-2">Détails</th>
            </tr>
          </thead>
          <tbody>
            {entrees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)]">
                  Aucune action enregistrée.
                </td>
              </tr>
            )}
            {entrees.map((e) => (
              <tr key={e.id} className="border-t border-[var(--border)] align-top">
                <td className="px-4 py-2 whitespace-nowrap">{formatParis(e.createdAt, { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-4 py-2">{e.acteur}</td>
                <td className="px-4 py-2 font-medium">{e.action}</td>
                <td className="px-4 py-2 text-[var(--muted)]">
                  {e.entite}
                  {e.entiteId ? ` · ${e.entiteId}` : ""}
                </td>
                <td className="px-4 py-2 text-xs text-[var(--muted)] break-all">{e.details ? JSON.stringify(e.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

