import { listerClientsAvecRelations } from "@/lib/queries";
import NouveauClientForm from "./NouveauClientForm";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = (await listerClientsAvecRelations()).slice(0, 50);

    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-xl md:text-2xl font-semibold">Clients</h1>

        <NouveauClientForm />

        <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
              <tr>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Téléphone</th>
                <th className="px-4 py-2">Adresse</th>
                <th className="px-4 py-2">Véhicule(s)</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)]">
                    Aucun client pour le moment.
                  </td>
                </tr>
              )}
              {clients.map((client) => (
                <tr key={client.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2">
                    {client.prenom} {client.nom}
                  </td>
                  <td className="px-4 py-2">{client.telephone}</td>
                  <td className="px-4 py-2">
                    {client.adresses[0]
                      ? `${client.adresses[0].adresse}, ${client.adresses[0].ville}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {client.vehicules.map((v) => v.marque ?? v.categorie).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
}

