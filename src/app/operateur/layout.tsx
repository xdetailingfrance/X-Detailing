import LogoMarque from "@/components/accueil/LogoMarque";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { authDesactivee } from "@/lib/auth";
import LogoutButton from "@/app/back-office/LogoutButton";
import DemoBanner from "@/components/DemoBanner";

export default async function OperateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  // En mode démo, un persona sans opérateur relié (base pas encore
  // peuplée) renvoie vers /demo plutôt que /login, qui n'a pas de sens
  // tant que l'authentification réelle est désactivée.
  const destinationSecours = authDesactivee() ? "/demo" : "/login";

  if (!session?.operateurId) redirect(destinationSecours); // défense en profondeur (déjà filtré par le middleware)

    const operateur = await db.operateur.findUnique({ where: { id: session.operateurId } });
    if (!operateur) redirect(destinationSecours);

  return (
    <div className="min-h-screen flex flex-col">
      <DemoBanner />
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <div className="flex items-center gap-2">
          <LogoMarque className="h-9 w-9" />
          <span className="font-semibold tracking-wide">
            {operateur.prenom} {operateur.nom}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {session.role !== "OPERATEUR" && (
            <a href="/back-office" className="text-sm text-[var(--accent)] hover:underline">
              ← Retour au back-office
            </a>
          )}
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 p-6 bg-[var(--background)]">{children}</main>
    </div>
  );
}

