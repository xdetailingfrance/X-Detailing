import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { aLaPermission } from "@/lib/permissions";
import { factureParId, lignesFacture, reglement } from "@/lib/facturation";
import { ENTREPRISE, adresseComplete, mentionsManquantes, ventilerTva } from "@/lib/entreprise";
import { formatParis } from "@/lib/heure";
import { dureeLisible } from "@/lib/heure";
import RenvoyerFacture from "./RenvoyerFacture";

export const dynamic = "force-dynamic";

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

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

  const lignes = lignesFacture(facture);
  const regle = reglement(facture);
  const tva = ventilerTva(facture.prixTotal);
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
      <article className="rounded-lg border border-[var(--border)] bg-white p-8 text-black print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-lg font-semibold">{ENTREPRISE.raisonSociale}</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              {ENTREPRISE.formeJuridique}
              {ENTREPRISE.capital ? ` au capital de ${ENTREPRISE.capital}` : ""}
              <br />
              {adresseComplete()}
              <br />
              SIRET {ENTREPRISE.siret} · {ENTREPRISE.rcs} {ENTREPRISE.siren}
              <br />
              TVA {ENTREPRISE.tva} · NAF {ENTREPRISE.naf.code}
              <br />
              {ENTREPRISE.email} · {ENTREPRISE.telephone}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">Facture</p>
            <p className="font-mono text-lg font-semibold">{facture.numeroFacture}</p>
            <p className="mt-1 text-xs text-neutral-600">
              Émise le {formatParis(facture.paiementConfirmeAt ?? facture.dateHeure, { dateStyle: "long" })}
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Client</p>
            <p className="mt-1 text-sm">
              {facture.client.prenom} {facture.client.nom}
              <br />
              {facture.adresse.adresse}
              <br />
              {facture.adresse.codePostal ?? ""} {facture.adresse.ville}
              <br />
              {facture.client.telephone}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Prestation</p>
            <p className="mt-1 text-sm">
              {formatParis(facture.dateHeure, { dateStyle: "long", timeStyle: "short" })}
              <br />
              Durée {dureeLisible(facture.dureeMinutes)}
              <br />
              Véhicule : {[facture.vehicule.marque, facture.vehicule.modele].filter(Boolean).join(" ") || facture.categorieVehicule.toLowerCase()}
              {facture.vehicule.immatriculation ? ` (${facture.vehicule.immatriculation})` : ""}
              {facture.operateur && (
                <>
                  <br />
                  Réalisée par {facture.operateur.prenom} {facture.operateur.nom}
                </>
              )}
            </p>
          </div>
        </section>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2">Désignation</th>
              <th className="py-2 text-center">Qté</th>
              <th className="py-2 text-right">P.U.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-2">{l.libelle}</td>
                <td className="py-2 text-center tabular-nums">{l.quantite}</td>
                <td className="py-2 text-right tabular-nums">{euros(l.prixUnitaire)}</td>
                <td className="py-2 text-right tabular-nums">{euros(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 flex justify-end">
          <table className="text-sm">
            <tbody>
              {tva?.assujetti && (
                <>
                  <tr>
                    <td className="py-1 pr-8 text-neutral-600">Total HT</td>
                    <td className="py-1 text-right tabular-nums">{euros(tva.ht)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-8 text-neutral-600">TVA {Math.round(tva.taux * 100)} %</td>
                    <td className="py-1 text-right tabular-nums">{euros(tva.tva)}</td>
                  </tr>
                </>
              )}
              <tr className="border-t border-neutral-300">
                <td className="py-2 pr-8 font-semibold">Total {tva?.assujetti ? "TTC" : ""}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{euros(facture.prixTotal)}</td>
              </tr>
              {regle.acompte > 0 && (
                <>
                  <tr>
                    <td className="py-1 pr-8 text-neutral-600">Acompte déjà réglé</td>
                    <td className="py-1 text-right tabular-nums">− {euros(regle.acompte)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-8 text-neutral-600">Solde réglé à la prestation</td>
                    <td className="py-1 text-right tabular-nums">{euros(regle.solde)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-8 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-600">
          {tva ? (
            tva.assujetti ? null : <p>{tva.mention}</p>
          ) : (
            <p className="font-semibold text-red-700 print:text-black">
              Régime de TVA non renseigné : la mention obligatoire manque sur cette facture.
            </p>
          )}
          <p className="mt-1">
            Réglée par {regle.mode === "CARTE" ? "carte bancaire" : regle.mode === "ESPECES" ? "espèces" : "moyen non précisé"}
            {facture.paiementConfirmeAt
              ? ` le ${formatParis(facture.paiementConfirmeAt, { dateStyle: "long" })}`
              : ""}
            . Facture acquittée, aucun solde restant dû.
          </p>
          <p className="mt-1">
            En cas de retard de paiement, pénalités au taux d&apos;intérêt légal majoré et indemnité forfaitaire de
            recouvrement de 40 € (articles L. 441-10 et D. 441-5 du code de commerce).
          </p>
        </footer>
      </article>
    </div>
  );
}
