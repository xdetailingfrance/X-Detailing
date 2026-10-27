import { listerClientsAvecRelations, listerOptionsActives, listerPacksAvecTarifs } from "@/lib/queries";
import NouveauRdvForm from "./NouveauRdvForm";

export const dynamic = "force-dynamic";

export default async function NouveauRdvPage() {
  const clients = (await listerClientsAvecRelations()).slice(0, 100);
  const packs = await listerPacksAvecTarifs();
  const options = await listerOptionsActives();

    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl md:text-2xl font-semibold">Nouveau rendez-vous</h1>
        <NouveauRdvForm
          clients={clients}
          packs={packs.map((p) => ({
            ...p,
            tarifs: p.tarifs.map((t) => ({ categorie: t.categorie, prix: t.prix.toString() })),
          }))}
          options={options.map((o) => ({ ...o, prix: o.prix.toString() }))}
        />
      </div>
    );
}

