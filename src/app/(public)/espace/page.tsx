import Link from "next/link";
import { currentUser } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { AccessLinkForm } from "./access-form";

export const metadata = { title: "Espace client · X Detailing", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CustomerAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const user = await currentUser();
  if (user?.role === "CUSTOMER") redirect("/espace/mes-rendez-vous");

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <p className="eyebrow text-xd-purple-bright">Espace client</p>
      <h1 className="mt-3 text-h1 text-xd-text text-balance">Retrouvez vos lavages</h1>
      <p className="mt-3 text-body text-xd-text-3">
        Vos rendez-vous, vos véhicules, vos photos avant et après, vos factures. Pas de
        mot de passe : on vous envoie un lien.
      </p>

      {erreur === "lien" && (
        <p className="mt-6 rounded-[--radius-xd-md] bg-xd-warn/12 px-4 py-3 text-meta text-xd-warn">
          Ce lien n&apos;est plus valable — ils expirent au bout d&apos;un quart d&apos;heure.
          Demandez-en un nouveau ci-dessous.
        </p>
      )}

      <AccessLinkForm />

      <p className="mt-8 text-meta text-xd-text-4">
        Pas encore client ?{" "}
        <Link href="/reserver" className="text-xd-purple-bright underline underline-offset-4">
          Réservez un premier lavage
        </Link>
      </p>
    </div>
  );
}
