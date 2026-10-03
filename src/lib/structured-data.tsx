import { BUSINESS, realValue, siteUrl } from "./business";

/**
 * Données structurées (§19).
 *
 * Règle unique : **on ne balise que ce qui est réellement affiché et réellement connu.**
 * Un `LocalBusiness` portant `[VILLE]` en adresse, ou une note agrégée inventée, n'est
 * pas une optimisation — c'est une déclaration fausse, et Google sanctionne le balisage
 * qui ne correspond pas à la page.
 *
 * Chaque champ passe donc par `realValue` : renseigné, il est publié ; laissé en
 * emplacement, il est simplement absent du JSON-LD. Un balisage partiel et exact vaut
 * mieux qu'un balisage complet et faux.
 */

type Jsonish = Record<string, unknown>;

/** Retire les champs vides pour ne pas publier de clés nulles. */
function compact(input: Jsonish): Jsonish {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) =>
      value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  );
}

export function localBusinessSchema(areaServed: string[]): Jsonish {
  const base = siteUrl();
  const street = realValue(BUSINESS.address.street);
  const city = realValue(BUSINESS.address.city);
  const postalCode = realValue(BUSINESS.address.postalCode);

  const address =
    street && city && postalCode
      ? {
          "@type": "PostalAddress",
          streetAddress: street,
          addressLocality: city,
          postalCode,
          addressCountry: BUSINESS.address.country,
        }
      : null;

  const geo =
    BUSINESS.geo.lat !== null && BUSINESS.geo.lng !== null
      ? { "@type": "GeoCoordinates", latitude: BUSINESS.geo.lat, longitude: BUSINESS.geo.lng }
      : null;

  const openingHours = BUSINESS.openingHours?.map((slot) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: slot.days,
    opens: slot.opens,
    closes: slot.closes,
  }));

  const sameAs = Object.values(BUSINESS.social)
    .map((value) => realValue(value))
    .filter((value): value is string => value !== null);

  return compact({
    "@context": "https://schema.org",
    "@type": "AutoWash",
    "@id": `${base}/#business`,
    name: BUSINESS.name,
    description: BUSINESS.summary,
    url: base,
    logo: `${base}/marque/logo-x-detailing.png`,
    image: `${base}/marque/logo-x-detailing.png`,
    telephone: realValue(BUSINESS.phoneE164),
    email: realValue(BUSINESS.email),
    address,
    geo,
    openingHoursSpecification: openingHours ?? null,
    areaServed: areaServed.map((name) => ({ "@type": "City", name })),
    sameAs,
    // `aggregateRating` est volontairement absent : il ne se déclare qu'à partir
    // d'avis réellement affichés sur la page, et jamais recopié à la main (§32).
  });
}

export type SchemaService = {
  name: string;
  description: string | null;
  lowestPriceCents: number;
};

export function serviceSchema(service: SchemaService, areaServed: string[]): Jsonish {
  const base = siteUrl();

  return compact({
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.name,
    description: service.description,
    provider: { "@id": `${base}/#business` },
    areaServed: areaServed.map((name) => ({ "@type": "City", name })),
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: (service.lowestPriceCents / 100).toFixed(2),
      // Le prix de la grille est un point de départ : il monte avec la catégorie.
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: (service.lowestPriceCents / 100).toFixed(2),
        priceCurrency: "EUR",
      },
      availability: "https://schema.org/InStock",
      url: `${base}/reserver`,
    },
  });
}

/** Balise un graphe JSON-LD dans la page. */
export function JsonLd({ data }: { data: Jsonish[] }) {
  return (
    <script
      type="application/ld+json"
      // Le contenu est construit ici, à partir de valeurs contrôlées : aucune
      // chaîne fournie par un visiteur n'y entre.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
