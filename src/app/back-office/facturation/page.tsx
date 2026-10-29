import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { etatEnvoiFactures, listerFactures } from "@/lib/facturation";
import { mentionsManquantes } from "@/lib/entreprise";
import { formatParis } from "@/lib/heure";

export const dynamic = "force-dynamic";

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

// Factures émises. Une facture est un rendez-vous clôturé et numéroté : la
// liste se lit donc directement dans les dossiers, sans table parallèle qui
// finirait par ne plus dire la même chose.
export default async function FacturationPage() {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "finances")) redirect("/back-office");

  const factures = await listerFactures();
  const envois = await etatEnvoiFactures(factures.map((f) => f.id));
  const manquantes = mentionsManquantes();
  const nonRecues = factures.filter((f) => envois.get(f.id)?.envoye !== true).length;
  const total = factures.reduce((s, f) => s + f.prixTotal, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Facturation</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          {factures.length === 0
            ? "Aucune facture émise pour le moment."
            : `${factures.length} facture${factures.length > 1 ? "s" : ""} · ${euros(total)}`}
        </p>
        {nonRecues > 0 && (
          <p className="mt-1 text-sm text-[var(--warning)]">
            {nonRecues} facture{nonRecues > 1 ? "s n'ont" : " n'a"} pas atteint le client par e-mail.
          </p>
        )}
      </div>

      {manquantes.length > 0 && (
        <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 p-3 text-sm">
          <strong className="text-[var(--warning)]">Mentions légales incomplètes :</strong> {manquantes.join(", ")}.
          Une facture émise sans elles est contestable — à renseigner dans{" "}
          <code className="text-xs">src/lib/entreprise.ts</code>.
        </p>
      )}

      <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
            <tr>
              <th className="px-4 py-2">Numéro</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Prestation</th>
              <th className="px-4 py-2 text-right">Montant</th>
              <th className="px-4 py-2">Règlement</th>
              <th className="px-4 py-2">E-mail client</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {factures.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-[var(--muted)]">
                  Les factures apparaissent ici dès qu&apos;un opérateur clôture une prestation et confirme son
                  paiement.
                </td>
              </tr>
            )}
            {factures.map((f) => (
              <tr key={f.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2 font-mono text-xs">{f.numeroFacture}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatParis(f.paiementConfirmeAt ?? f.dateHeure, { dateStyle: "short" })}
                </td>
                <td className="px-4 py-2">
                  {f.client.prenom} {f.client.nom}
                  <span className="block text-xs text-[var(--muted)]">{f.client.email ?? "sans e-mail"}</span>
                </td>
                <td className="px-4 py-2">
                  {f.pack.nom}
                  {f.fraisDeplacement > 0 && (
                    <span className="block text-xs text-[var(--muted)]">dont {euros(f.fraisDeplacement)} de déplacement</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{euros(f.prixTotal)}</td>
                <td className="px-4 py-2">
                  {f.modePaiement === "CARTE" ? "Carte" : f.modePaiement === "ESPECES" ? "Espèces" : "—"}
                </td>
                <td className="px-4 py-2">
                  {(() => {
                    const envoi = envois.get(f.id);
                    if (envoi?.envoye) return <span className="text-[var(--success)]">Envoyée</span>;
                    if (envoi) return <span className="text-[var(--warning)]" title={envoi.erreur}>Échec</span>;
                    return <span className="text-[var(--muted)]">Jamais envoyée</span>;
                  })()}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/back-office/facturation/${f.id}`} className="underline hover:text-[var(--accent)]">
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
