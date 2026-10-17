import { BUSINESS, realValue, siteUrl } from "./business";
import { FORMULES } from "./catalogue";

/**
 * Données structurées.
 *
 * Règle unique : on ne balise que ce qui est réellement affiché et réellement connu.
 * Chaque champ facultatif passe par `realValue` : renseigné, il est publié ; laissé en
 * emplacement, il est absent du JSON-LD. Aucune note agrégée n'est déclarée : elle ne
 * se publie qu'à partir d'avis réellement affichés sur la page.
 */

type Jsonish = Record<string, unknown>;

function compact(input: Jsonish): Jsonish {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) =>
        value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  );
}

export function localBusinessSchema(): Jsonish {
  const base = siteUrl();
  const prix = FORMULES.flatMap((f) => Object.values(f.prix));

  return compact({
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "@id": `${base}/#business`,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    description: BUSINESS.summary,
    url: base,
    logo: `${base}/marque/logo-x-detailing.jpeg`,
    image: `${base}/marque/logo-x-detailing.jpeg`,
    telephone: realValue(BUSINESS.phoneE164),
    email: realValue(BUSINESS.email),
    // Pas d'adresse ni de coordonnées : entreprise mobile, comme sa fiche Google.
    // La zone desservie tient lieu de localisation.
    areaServed: [
      { "@type": "City", name: "Bordeaux" },
      { "@type": "City", name: "Pompignac" },
      { "@type": "AdministrativeArea", name: "Gironde" },
    ],
    priceRange: `${Math.min(...prix)} € – ${Math.max(...prix)} €`,
    currenciesAccepted: "EUR",
    sameAs: [BUSINESS.google.profileUrl],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Formules",
      itemListElement: FORMULES.map((f) => {
        const montants = Object.values(f.prix);
        return {
          "@type": "Offer",
          name: f.nom,
          priceCurrency: "EUR",
          price: Math.min(...montants).toFixed(2),
          priceSpecification: {
            "@type": "PriceSpecification",
            priceCurrency: "EUR",
            minPrice: Math.min(...montants).toFixed(2),
            maxPrice: Math.max(...montants).toFixed(2),
          },
          availability: "https://schema.org/InStock",
          url: `${base}/#formules`,
          itemOffered: {
            "@type": "Service",
            name: f.nom,
            description: f.accroche,
            provider: { "@id": `${base}/#business` },
          },
        };
      }),
    },
  });
}

/** Balise un graphe JSON-LD dans la page. */
export function JsonLd({ data }: { data: Jsonish[] }) {
  return (
    <script
      type="application/ld+json"
      // Construit ici, à partir de valeurs contrôlées : aucune saisie de visiteur n'y entre.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
