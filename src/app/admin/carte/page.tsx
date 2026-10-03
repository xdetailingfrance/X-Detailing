import { PageHeader } from "@/components/ui";
import { requireBackOffice } from "@/lib/auth/guard";
import { getNetworkTracking } from "@/server/tracking";
import { NetworkMap } from "./network-map";

export const metadata = { title: "Carte du réseau · X Detailing OS" };
export const dynamic = "force-dynamic";

/** §20 — « carte live des opérateurs et rendez-vous », §11 — position et ETA. */
export default async function LiveMapPage() {
  await requireBackOffice();

  // Premier état rendu côté serveur : la carte n'apparaît jamais vide en attendant le flux.
  const initial = await getNetworkTracking();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Carte du réseau"
        lead="Position des opérateurs en trajet, rendez-vous en cours et retards prévus."
      />

      <NetworkMap initial={initial} />
    </div>
  );
}
