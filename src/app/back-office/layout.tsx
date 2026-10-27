import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import NavBackOffice from "./NavBackOffice";
import DemoBanner from "@/components/DemoBanner";
import LolaRaccourci from "@/components/lola/LolaRaccourci";
import { aLaPermission, LIBELLE_ROLE } from "@/lib/permissions";
import { RUBRIQUES } from "@/lib/rubriques";

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login"); // défense en profondeur (déjà filtré par le middleware)

  // Chaque rubrique n'apparaît qu'avec la permission correspondante
  // (vérifiée aussi côté serveur par src/proxy.ts).
  const liens = RUBRIQUES.filter((r) => aLaPermission(session.role, r.permission)).map(({ href, libelle, icone, groupe, bientot }) => ({
    href,
    libelle,
    icone,
    groupe,
    bientot,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <div className="flex flex-1 flex-col md:flex-row">
        <NavBackOffice
          liens={liens}
          email={session.email}
          role={LIBELLE_ROLE[session.role]}
          espaceOperateur={!!session.operateurId}
          nouveauRdv={aLaPermission(session.role, "planning")}
        />
        <main className="min-w-0 flex-1 bg-[radial-gradient(80%_50%_at_70%_0%,rgba(109,40,217,0.10),transparent_60%)] p-4 pb-24 md:p-8">{children}</main>
      </div>
      {aLaPermission(session.role, "lola") && <LolaRaccourci />}
    </div>
  );
}

