import Link from "next/link";
import type { Metadata } from "next";
import LogoMarque from "@/components/accueil/LogoMarque";
import { prestationsPubliques } from "@/lib/prestationsPubliques";
import {
  DELAI_MINIMUM_MINUTES,
  HEURES_CRENEAUX,
  HEURES_CRENEAUX_DIMANCHE,
  HEURES_CRENEAUX_SAMEDI,
} from "@/lib/disponibilites";
import { TRANCHES_DEPLACEMENT } from "@/lib/deplacement";
import { ENTREPRISE, adresseComplete, mentionsManquantes } from "@/lib/entreprise";
import { dureeLisible } from "@/lib/heure";

export const metadata: Metadata = {
  title: "Conditions générales de vente — X Detailing",
  description: "Conditions générales de vente des prestations de nettoyage automobile à domicile X Detailing.",
};

export const revalidate = 3600;

// Date de la version du texte, pas celle du jour : des conditions générales
// datées d'aujourd'hui à chaque visite ne prouvent plus rien. À faire suivre
// quand le texte change.
const EN_VIGUEUR_AU = "28 octobre 2026";

// Délai d'annulation sans perte de l'acompte. Purement contractuel : aucun
// code ne le fait respecter, c'est la direction qui tranche au cas par cas.
const DELAI_ANNULATION_HEURES = 24;
// Conservation des données de réservation. Les pièces comptables y échappent :
// la loi impose dix ans, et le code refuse d'effacer un RDV facturé.
const CONSERVATION_ANS = 2;

/**
 * Conditions générales de vente.
 *
 * Les éléments vérifiables — prestations, durées, créneaux, acompte, frais de
 * déplacement — sont lus dans le code qui les applique réellement, et non
 * recopiés : des conditions qui annoncent un tarif que le site ne pratique pas
 * engagent l'entreprise sur le tarif annoncé.
 *
 * L'identité légale vient de src/lib/entreprise.ts, jamais d'une copie : une
 * facture qui porte un SIRET différent de celui des conditions générales est
 * une facture contestable. Si un champ y manque, mentionsManquantes() le dit
 * en bas de page — un emplacement visible se corrige, une donnée plausible
 * fabriquée traverse la mise en ligne sans que personne ne la voie.
 */
export default async function ConditionsGenerales() {
  const prestations = await prestationsPubliques();
  const manquantes = mentionsManquantes();

  return (
    <div className="site-clair min-h-screen bg-white">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" aria-label="X Detailing — accueil">
          <LogoMarque className="h-12 w-12" />
        </Link>
        <Link href="/" className="text-xs uppercase tracking-[0.18em] text-[var(--chrome)]/80 hover:text-[var(--encre)]">
          Retour au site
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--encre)]">
          Conditions générales de vente
        </h1>
        <p className="mt-2 text-sm text-[var(--chrome)]/70">
          En vigueur au {EN_VIGUEUR_AU}.
        </p>

        <Article titre="1. Identification du prestataire">
          <p>
            Les présentes conditions régissent les prestations proposées par{" "}
            <strong>{ENTREPRISE.raisonSociale}</strong>, {ENTREPRISE.formeJuridique}
            {ENTREPRISE.capital ? ` au capital de ${ENTREPRISE.capital}` : ""},
            immatriculée le {ENTREPRISE.immatriculationLe} au {ENTREPRISE.rcs} sous le numéro SIREN{" "}
            {ENTREPRISE.siren}, SIRET {ENTREPRISE.siret}, dont le siège social est situé{" "}
            {adresseComplete()}.
          </p>
          <p>
            Activité : {ENTREPRISE.naf.libelle} (code NAF {ENTREPRISE.naf.code}). Numéro de TVA
            intracommunautaire : {ENTREPRISE.tva}.
          </p>
          <p>
            Contact : {ENTREPRISE.email} · {ENTREPRISE.telephone}.
          </p>
        </Article>

        <Article titre="2. Prestations">
          <p>
            X Detailing réalise le nettoyage de véhicules sur le lieu choisi par le client —
            domicile, bureau ou parking — dans la région bordelaise. L&apos;opérateur se déplace
            avec son eau, ses produits et son matériel.
          </p>
          <ul className="mt-3 space-y-1.5">
            {prestations.map((p) => (
              <li key={p.packId}>
                <strong>{p.titre}</strong> — durée estimée {p.duree}.
                {p.description ? ` ${p.description}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-3">
            Les durées sont des estimations. L&apos;état réel du véhicule peut les allonger ;
            le cas échéant, l&apos;opérateur en informe le client avant de commencer.
          </p>
        </Article>

        <Article titre="3. Prix">
          <p>
            Les prix sont indiqués en euros toutes taxes comprises et dépendent de la catégorie du
            véhicule. Le prix applicable est celui affiché au moment de la réservation.
          </p>
          <p>
            Si la catégorie constatée sur place ne correspond pas à celle déclarée, le tarif est
            recalculé devant le client, qui reste libre de refuser la prestation sans frais.
          </p>
        </Article>

        <Article titre="4. Frais de déplacement">
          <p>
            Un supplément de déplacement est calculé selon la distance routière entre le point de
            départ (Pompignac, 33) et l&apos;adresse d&apos;intervention :
          </p>
          <ul className="mt-3 space-y-1.5">
            {TRANCHES_DEPLACEMENT.map((t, i) => {
              const precedent = i === 0 ? 0 : TRANCHES_DEPLACEMENT[i - 1].jusquaKm;
              return (
                <li key={t.jusquaKm}>
                  de {precedent} à {t.jusquaKm} km :{" "}
                  {t.prix === 0 ? "offert" : `${t.prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`}
                </li>
              );
            })}
            <li>au-delà : sur devis.</li>
          </ul>
          <p className="mt-3">Le montant est affiché avant la validation de la réservation.</p>
        </Article>

        <Article titre="5. Réservation et créneaux">
          <p>
            Les départs sont fixes : {HEURES_CRENEAUX.join(", ")} du lundi au vendredi,{" "}
            {HEURES_CRENEAUX_SAMEDI.join(" et ")} le samedi, {HEURES_CRENEAUX_DIMANCHE.join(" et ")} le
            dimanche. Un créneau n&apos;est proposé que si un opérateur peut le tenir en entier.
          </p>
          <p>
            Un créneau se réserve en ligne jusqu&apos;à {dureeLisible(DELAI_MINIMUM_MINUTES)} avant
            le départ, tant qu&apos;il reste disponible. Passé ce délai, le client peut contacter
            l&apos;entreprise directement.
          </p>
        </Article>

        <Article titre="6. Acompte et paiement">
          <p>
            Un acompte de 10 % du montant total est demandé à la réservation, par carte bancaire via
            Stripe. Le créneau n&apos;est acquis qu&apos;une fois ce paiement validé.
          </p>
          <p>
            Le solde est réglé à l&apos;issue de la prestation, par carte ou en espèces. Une facture
            est adressée au client par courrier électronique.
          </p>
        </Article>

        <Article titre="7. Annulation et report">
          <p>
            Jusqu&apos;à {DELAI_ANNULATION_HEURES} heures avant le créneau, le client peut annuler
            ou demander un report : la prestation est alors reportée ou remboursée intégralement,
            acompte compris.
          </p>
          <p>
            Dans les {DELAI_ANNULATION_HEURES} heures qui précèdent le créneau, l&apos;annulation
            n&apos;est plus possible et l&apos;acompte est conservé — y compris lorsque la
            réservation a été prise pendant ce délai. Le créneau a été immobilisé et ne peut plus
            être proposé à un autre client. Le solde, lui, n&apos;est jamais dû pour une prestation
            non réalisée.
          </p>
          <p>
            X Detailing peut, selon les disponibilités, proposer de déplacer le créneau plutôt que
            de le perdre. Il s&apos;agit d&apos;un geste commercial, non d&apos;un droit.
          </p>
          <p>
            Cette règle s&apos;applique sans préjudice du droit de rétractation prévu à
            l&apos;article 8.
          </p>
          <p>
            X Detailing peut reporter une intervention en cas d&apos;intempéries rendant la
            prestation impossible ou son résultat non conforme. Un nouveau créneau est alors proposé
            sans frais.
          </p>
        </Article>

        <Article titre="8. Droit de rétractation">
          <p>
            Le client consommateur dispose d&apos;un délai de quatorze jours pour se rétracter d&apos;un
            contrat conclu à distance. Lorsqu&apos;il demande expressément que la prestation commence
            avant la fin de ce délai, il renonce à ce droit une fois la prestation pleinement
            exécutée, conformément à l&apos;article L. 221-28 du code de la consommation.
          </p>
          <p className="text-[var(--chrome)]/70">
            [À FAIRE VALIDER : la rédaction de cette clause et le formulaire de rétractation annexé
            doivent être vérifiés par un conseil juridique.]
          </p>
        </Article>

        <Article titre="9. Photographies">
          <p>
            Quatre photographies sont prises à l&apos;arrivée et quatre au départ, aux mêmes angles.
            Elles constituent la preuve de l&apos;état du véhicule avant et après intervention, et
            sont accessibles au client depuis le lien de suivi de son rendez-vous.
          </p>
          <p>
            Elles ne sont ni publiées ni utilisées à des fins commerciales sans l&apos;accord exprès
            du client.
          </p>
        </Article>

        <Article titre="10. Responsabilité">
          <p>
            L&apos;opérateur signale au client, avant de commencer, tout dommage préexistant constaté
            sur le véhicule. Le client signe le relevé de prise en charge.
          </p>
          <p>
            X Detailing ne saurait être tenue responsable des dommages antérieurs à son
            intervention, ni des objets de valeur laissés dans le véhicule.
          </p>
        </Article>

        <Article titre="11. Données personnelles">
          <p>
            Les informations recueillies sont nécessaires au traitement de la réservation et à la
            facturation. Elles sont conservées {CONSERVATION_ANS} ans à compter de la dernière
            prestation, à l&apos;exception des pièces comptables — factures et justificatifs de
            paiement — que l&apos;article L. 123-22 du code de commerce impose de garder dix ans.
            Elles ne sont transmises à aucun tiers en dehors des prestataires techniques
            nécessaires au service : paiement, envoi des messages, hébergement.
          </p>
          <p>
            Le client dispose d&apos;un droit d&apos;accès, de rectification et d&apos;effacement,
            qu&apos;il peut exercer à {ENTREPRISE.email}.
          </p>
        </Article>

        <Article titre="12. Litiges">
          <p>
            En cas de difficulté, le client est invité à contacter l&apos;entreprise à{" "}
            {ENTREPRISE.email} ou au {ENTREPRISE.telephone} : la très grande majorité des
            désaccords se règlent ainsi.
          </p>
          <p>
            À défaut d&apos;accord amiable, le litige relève des tribunaux compétents. Le droit
            français est applicable.
          </p>
        </Article>

        <p className="mt-12 rounded-lg border border-[var(--encre)]/10 bg-[var(--surface-2,#f7f7fa)] p-4 text-sm text-[var(--chrome)]/80">
          {manquantes.length > 0 && <>Restent à renseigner : {manquantes.join(", ")}. </>}
          Ce texte doit être relu par un conseil juridique avant d&apos;engager l&apos;entreprise.
          Les prestations, durées, créneaux, acompte et frais de déplacement décrits ici sont en
          revanche lus directement dans le système qui les applique : ils ne peuvent pas diverger
          de ce que le site pratique.
        </p>
      </main>
    </div>
  );
}

function Article({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-[var(--encre)]">{titre}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[var(--chrome)]">{children}</div>
    </section>
  );
}
