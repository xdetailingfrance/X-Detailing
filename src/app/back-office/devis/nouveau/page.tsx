import { listerPacksAvecTarifs } from "@/lib/queries";
import { listerOptionsActives } from "@/lib/queries";
import NouveauDevisForm from "./NouveauDevisForm";

export const dynamic = "force-dynamic";

export default async function NouveauDevisPage() {
  const packs = await listerPacksAvecTarifs();
  const options = await listerOptionsActives();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl md:text-2xl font-semibold">Nouveau devis</h1>
      <NouveauDevisForm
        packs={packs.map((p) => ({ ...p, tarifs: p.tarifs.map((t) => ({ categorie: t.categorie, prix: t.prix.toString() })) }))}
        options={options.map((o) => ({ ...o, prix: o.prix.toString() }))}
      />
    </div>
  );
}

