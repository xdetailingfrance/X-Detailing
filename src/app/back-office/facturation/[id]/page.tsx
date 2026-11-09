import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { factureParId } from "@/lib/facturation";
import { mentionsManquantes } from "@/lib/entreprise";
import RenvoyerFacture from "./RenvoyerFacture";
import FactureImprimable from "@/components/facture/FactureImprimable";

export const dynamic = "force-dynamic";

// Facture consultable et imprimable. Le PDF se fait par l'impression du
// navigateur plutôt qu'en embarquant une bibliothèque : une page imprimable
// reste lisible, sélectionnable et traduisible, ce qu'un PDF généré côté
// serveur n'est pas toujours.
export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !aLaPermission(session.role, "finances")) redirect("/back-office");

  const { id } = await params;
  const facture = await factureParId(id);
  if (!facture) notFound();

  const manquantes = mentionsManquantes();

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/back-office/facturation" className="text-sm underline text-[var(--muted)]">
          ← Toutes les factures
        </Link>
        <RenvoyerFacture
          rendezVousId={facture.id}
          email={facture.client.email}
          numero={facture.numeroFacture ?? ""}
        />
      </div>

      {manquantes.length > 0 && (
        <p className="rounded-lg border border-[var(--warning)] bg-[var(--warning)]/10 p-3 text-sm print:hidden">
          <strong className="text-[var(--warning)]">À compléter avant de remettre cette facture :</strong>{" "}
          {manquantes.join(", ")}.
        </p>
      )}

      {/* La facture elle-même : fond blanc et encre noire, pour l'impression. */}
      <FactureImprimable facture={facture} />
    </div>
  );
}
