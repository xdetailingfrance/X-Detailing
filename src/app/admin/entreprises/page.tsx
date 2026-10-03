import Link from "next/link";
import { requireBackOffice } from "@/lib/auth/guard";
import { getFleetAccounts } from "@/server/invoicing";
import { formatEuros } from "@/server/pricing";
import {
  Card, EmptyState, PageHeader, StatRow, StatTile, Td, Th,
} from "@/components/ui";

export const metadata = { title: "Comptes entreprise · X Detailing OS" };
export const dynamic = "force-dynamic";

/** §24 — comptes professionnels et flottes. */
export default async function FleetAccountsPage() {
  await requireBackOffice();
  const accounts = await getFleetAccounts();

  const vehicles = accounts.reduce((sum, a) => sum + a.vehicleCount, 0);
  const revenue = accounts.reduce((sum, a) => sum + a.revenueYearCents, 0);
  const unpaid = accounts.reduce((sum, a) => sum + a.unpaidCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comptes entreprise"
        lead="Flottes, responsables et facturation mensuelle."
      />

      <StatRow>
        <StatTile label="Comptes" value={String(accounts.length)} />
        <StatTile label="Véhicules suivis" value={String(vehicles)} />
        <StatTile label="CA de l'année" value={formatEuros(revenue)} tone="positive" />
        <StatTile
          label="Factures en attente"
          value={formatEuros(unpaid)}
          hint={`${accounts.reduce((sum, a) => sum + a.unpaidInvoices, 0)} facture(s)`}
          tone={unpaid > 0 ? "warning" : "neutral"}
        />
      </StatRow>

      <Card title="Comptes suivis">
        {accounts.length === 0 ? (
          <EmptyState>
            Aucun compte entreprise. Un client de type « entreprise » apparaît ici
            automatiquement.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className="bg-ink-50">
                <tr>
                  <Th>Compte</Th>
                  <Th className="text-right">Véhicules</Th>
                  <Th className="text-right">Sites</Th>
                  <Th className="text-right">Lavages (année)</Th>
                  <Th className="text-right">Fréquence</Th>
                  <Th className="text-right">CA année</Th>
                  <Th className="text-right">À encaisser</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-ink-50/60">
                    <Td>
                      <Link
                        href={`/admin/entreprises/${account.id}`}
                        className="font-medium text-ink-900 hover:text-brand-600"
                      >
                        {account.companyName}
                      </Link>
                      <p className="text-xs text-ink-400">
                        {account.phone}
                        {account.siret && ` · SIRET ${account.siret}`}
                      </p>
                    </Td>
                    <Td className="tabular text-right">{account.vehicleCount}</Td>
                    <Td className="tabular text-right">{account.addressCount}</Td>
                    <Td className="tabular text-right">{account.washesThisYear}</Td>
                    <Td className="tabular text-right text-ink-500">
                      {account.averageIntervalDays === null
                        ? "—"
                        : `1 / ${account.averageIntervalDays} j`}
                    </Td>
                    <Td className="tabular text-right font-medium">
                      {formatEuros(account.revenueYearCents)}
                    </Td>
                    <Td className="tabular text-right">
                      {account.unpaidCents > 0 ? (
                        <span className="text-xd-warn">{formatEuros(account.unpaidCents)}</span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          Fréquence : intervalle moyen entre deux lavages sur l&apos;année, tous véhicules
          confondus (§24).
        </p>
      </Card>
    </div>
  );
}
