/**
 * La facture, telle qu'elle est remise au client.
 *
 * Un seul rendu, partagé entre le back-office et la page de suivi du client :
 * deux gabarits divergeraient, et une facture qui ne dit pas la même chose
 * selon qui la regarde ne vaut rien.
 *
 * Fond blanc et encre noire quel que soit le thème de la page : c'est un
 * document, destiné à être imprimé ou enregistré en PDF par le navigateur.
 */
import type { Facture } from "@/lib/facturation";
import { lignesFacture, reglement } from "@/lib/facturation";
import { ENTREPRISE, adresseComplete, ventilerTva } from "@/lib/entreprise";
import { dureeLisible, formatParis } from "@/lib/heure";

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function FactureImprimable({ facture }: { facture: Facture }) {
  const lignes = lignesFacture(facture);
  const regle = reglement(facture);
  const tva = ventilerTva(facture.prixTotal);

  return (
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
  );
}
