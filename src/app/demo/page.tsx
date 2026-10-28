import LogoMarque from "@/components/accueil/LogoMarque";
import { authDesactivee } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Carte = {
  titre: string;
  description: string;
  href?: string;
  email?: string;
  disponible: boolean;
};

export default async function DemoPage() {
  const desactive = authDesactivee();

  let emailOwner: string | undefined;
  let emailCommercial: string | undefined;
  let emailOperateur: string | undefined;
  if (desactive) {
    const parRole = (role: "OWNER" | "COMMERCIAL" | "OPERATEUR") => db.utilisateur.findFirst({ where: { role }, orderBy: { createdAt: "asc" } });
    emailOwner = (await parRole("OWNER"))?.email;
    emailCommercial = (await parRole("COMMERCIAL"))?.email;
    emailOperateur = (await parRole("OPERATEUR"))?.email;
  }

  const cartes: Carte[] = [
    {
      titre: "Client",
      description:
        "Site de réservation public (choix véhicule → pack → options → créneau → acompte). Pas encore développé —prévu en phase 2.",
      disponible: false,
    },
    {
      titre: "Opérateur",
      description: "Espace « Ma semaine » : planning, prestations du jour, reste à payer — jamais le CA.",
      href: "/api/demo/persona?role=OPERATEUR",
      email: emailOperateur,
      disponible: true,
    },
    {
      titre: "Conseiller",
      description: "Back-office Commercial : clients, planning, création de RDV, affectation — sans aucune donnée financière.",
      href: "/api/demo/persona?role=COMMERCIAL",
      email: emailCommercial,
      disponible: true,
    },
    {
      titre: "Direction",
      description: "Back-office complet + Finances (CA, commissions) + Packs & Tarifs + Opérateurs + son propre espace opérateur.",
      href: "/api/demo/persona?role=OWNER",
      email: emailOwner,
      disponible: true,
    },
  ];

   return (
     <div className="min-h-screen flex flex-col items-center px-4 py-16 gap-10">
       <div className="flex flex-col items-center gap-3 text-center">
         <LogoMarque className="h-24 w-24" />
         <h1 className="text-2xl font-semibold">X Detailing OS — Mode démonstration</h1>
         <p className="text-[var(--muted)] max-w-lg">
           Choisissez un profil pour ouvrir directement l&apos;interface correspondante, avec les
           vraies permissions RBAC appliquées (un Conseiller ne verra jamais le CA, par exemple).
         </p>
         {!desactive && (
           <p className="text-sm text-[var(--warning)] max-w-lg">
             L&apos;authentification réelle est actuellement active (DISABLE_AUTH=false) : ces liens
             redirigeront vers la page de connexion.
           </p>
         )}
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        {cartes.map((carte) => (
          <a
            key={carte.titre}
            href={carte.disponible ? carte.href : undefined}
            aria-disabled={!carte.disponible}
            className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 flex flex-col gap-2 transition ${
              carte.disponible
                ? "hover:border-[var(--accent)] hover:bg-[var(--surface-2)] cursor-pointer"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-lg">{carte.titre}</h2>
              {!carte.disponible && (
                <span className="text-xs text-[var(--muted)] uppercase tracking-wide">Bientôt</span>
              )}
            </div>
            <p className="text-sm text-[var(--muted)]">{carte.description}</p>
            {carte.email && (
              <p className="text-xs text-[var(--muted)] mt-1">Compte : {carte.email}</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

