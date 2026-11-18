import { ENTREPRISE } from "@/lib/entreprise";
import { origineSite } from "@/lib/email";
import type { PrestationPublique } from "@/lib/prestationsPubliques";
import { COMMUNES, questions } from "@/components/accueil/SectionsAccueil";

/**
 * Données structurées de la fiche d'entreprise, pour les moteurs et les
 * assistants. La page n'en portait aucune.
 *
 * AUCUNE ADRESSE n'est déclarée : X Detailing se déplace, et sa fiche
 * Google n'en affiche pas non plus. Pour une entreprise de service à
 * domicile, c'est `areaServed` qui décrit la couverture — déclarer le siège
 * ferait apparaître Pompignac comme lieu d'accueil de la clientèle, ce
 * qu'il n'est pas.
 *
 * Les horaires ne sont PAS déclarés : les créneaux du site sont des heures
 * de début d'intervention, pas des heures d'ouverture — baliser « ferme à
 * 15h00 » ferait afficher « Fermé » sur la fiche dès l'après-midi. Les
 * horaires se tiennent sur la fiche Google, seule source que Google affiche.
 *
 * Les prix viennent de la grille réelle : un balisage qui annoncerait un
 * tarif absent de la page serait du contenu trompeur, sanctionné comme tel.
 */
export default function DonneesStructurees({ prestations }: { prestations: PrestationPublique[] }) {
  const site = origineSite();
  const prix = prestations.flatMap((p) => p.tarifs.map((t) => t.prix)).filter((n) => n > 0);

  const donnees = {
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "@id": `${site}/#entreprise`,
    name: ENTREPRISE.raisonSociale,
    alternateName: "X Detailing",
    description:
      "Lavage et detailing automobile à domicile dans la métropole bordelaise : nettoyage intérieur, intérieur et extérieur, lavage à la main.",
    url: site,
    telephone: ENTREPRISE.telephone,
    ...(ENTREPRISE.email ? { email: ENTREPRISE.email } : {}),
    image: `${site}/marque/logo-1254.webp`,
    logo: `${site}/marque/logo-1254.webp`,
    vatID: ENTREPRISE.tva,
    currenciesAccepted: "EUR",
    paymentAccepted: "Carte bancaire, espèces",
    ...(prix.length > 0 ? { priceRange: `${Math.min(...prix)}–${Math.max(...prix)} €` } : {}),
    areaServed: COMMUNES.map((name) => ({ "@type": "City", name, addressCountry: "FR" })),
    sameAs: [ENTREPRISE.ficheGoogle],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Prestations de lavage à domicile",
      itemListElement: prestations.map((p) => ({
        "@type": "Offer",
        name: p.titre,
        description: p.accroche,
        ...(p.tarifs.length > 0
          ? {
              priceSpecification: {
                "@type": "PriceSpecification",
                minPrice: Math.min(...p.tarifs.map((t) => t.prix)),
                maxPrice: Math.max(...p.tarifs.map((t) => t.prix)),
                priceCurrency: "EUR",
                valueAddedTaxIncluded: true,
              },
            }
          : {}),
        itemOffered: { "@type": "Service", name: p.titre, serviceType: "Lavage automobile à domicile" },
      })),
    },
  };

  /**
   * Les questions-réponses sont balisées parce qu'elles sont VISIBLES sur la
   * page, mot pour mot. Google n'affiche plus d'extrait enrichi FAQ depuis
   * 2023 pour les sites non institutionnels : l'intérêt est ailleurs, dans
   * l'extraction par les assistants, qui citent des réponses autoportantes.
   */
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${site}/#questions`,
    mainEntity: questions(prestations).map(({ q, r }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: r },
    })),
  };

  return (
    <>
    <script
      type="application/ld+json"
      // Le JSON est sérialisé par nous : aucune entrée utilisateur ne s'y
      // trouve, et les chevrons sont échappés pour fermer toute évasion de
      // la balise.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees).replace(/</g, "\\u003c") }}
    />
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faq).replace(/</g, "\\u003c") }}
    />
    </>
  );
}
