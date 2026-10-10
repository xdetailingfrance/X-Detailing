import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/db";
import { BUSINESS, siteUrl } from "@/lib/business";
import { JsonLd, serviceSchema } from "@/lib/structured-data";
import { formatDuration } from "@/server/time";
import { VEHICLES } from "../reserver/vehicles";
import { CarZones } from "../home/car-zones";
import { Method } from "../home/method";

/**
 * Page prestation (§28).
 *
 * Elle doit se comprendre en trente secondes et contenir de quoi répondre à une requête
 * précise : combien ça coûte pour ma voiture, combien de temps, ce qui est traité, ce
 * qui ne l'est pas.
 *
 * Tout vient de la base. Rien n'est rédigé ici qui ne soit vérifiable dans le catalogue :
 * une page de prestation qui promet autre chose que le devis est une réclamation à venir.
 */

export const dynamic = "force-dynamic";

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

async function loadService(slug: string) {
  return prisma.service.findFirst({
    where: { slug, active: true },
    include: { pricing: true, options: { include: { option: true } } },
  });
}

export async function generateMetadata({ params }: PageProps<"/[service]">) {
  const { service: slug } = await params;
  const service = await loadService(slug);
  if (!service) return {};

  const lowest = Math.min(...service.pricing.map((p) => p.priceCents));
  const scope = service.kind === "INTERIOR" ? "intérieur" : "intérieur et extérieur";

  return {
    title: `${service.name} — nettoyage ${scope} à ${BUSINESS.city} · ${BUSINESS.name}`,
    description: `${service.description ?? ""} À partir de ${euros(lowest)}. Prix ferme, à domicile ou sur votre lieu de travail.`.trim(),
    alternates: { canonical: `/${service.slug}` },
  };
}

export default async function ServicePage({ params }: PageProps<"/[service]">) {
  const { service: slug } = await params;
  const service = await loadService(slug);

  // Toute adresse inconnue tombe ici : la route racine capte le reste du site.
  if (!service) notFound();

  const sectors = await prisma.sector.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { name: true },
  });
  const areaServed = sectors.map((sector) => sector.name);

  const prices = VEHICLES.map(([key, label]) => ({
    key,
    label,
    pricing: service.pricing.find((p) => p.vehicleClass === key),
  })).filter((row) => row.pricing);

  const cheapest = prices[0];
  const dearest = prices[prices.length - 1];
  const shortest = Math.min(...service.pricing.map((p) => p.durationMin));
  const longest = Math.max(...service.pricing.map((p) => p.durationMin));

  /**
   * Le tarif dépend-il de la catégorie du véhicule ?
   *
   * Tant qu'il n'en dépend pas, toute la page doit cesser de le prétendre : pas de
   * « à partir de » devant un prix unique, pas de tableau à sept lignes identiques,
   * pas de réponse qui annonce une fourchette entre deux montants égaux.
   */
  const variesByVehicle = new Set(service.pricing.map((p) => p.priceCents)).size > 1;
  const variesInDuration = shortest !== longest;

  const interior = service.kind !== "EXTERIOR";
  const exterior = service.kind !== "INTERIOR";
  const formulas: Array<"Concession" | "Concession Luxe"> = exterior
    ? ["Concession", "Concession Luxe"]
    : ["Concession"];

  /**
   * Réponses courtes et factuelles (§17).
   *
   * Construites à partir des tarifs et des durées réels : c'est ce qu'un moteur
   * génératif peut citer sans se tromper, et ce qu'un visiteur cherche vraiment.
   */
  const questions = [
    {
      q: `Combien coûte la formule ${service.name} à ${BUSINESS.city} ?`,
      a: variesByVehicle
        ? `À partir de ${euros(cheapest.pricing!.priceCents)} pour une ${cheapest.label.toLowerCase()}, jusqu'à ${euros(dearest.pricing!.priceCents)} pour un ${dearest.label.toLowerCase()}. Le prix est fixé par la catégorie du véhicule, pas par son état : il est ferme et annoncé avant la réservation.`
        : `${euros(cheapest.pricing!.priceCents)}, quelle que soit la voiture. Le prix ne dépend ni de la catégorie du véhicule ni de son état : il est ferme et annoncé avant la réservation.`,
    },
    {
      q: "Combien de temps faut-il ?",
      a: variesInDuration
        ? `De ${formatDuration(shortest)} à ${formatDuration(longest)} selon la taille du véhicule. L'opérateur reste sur place pendant toute la durée ; vous n'avez pas à déposer ni à récupérer la voiture.`
        : `${formatDuration(shortest)}. L'opérateur reste sur place pendant toute la durée ; vous n'avez pas à déposer ni à récupérer la voiture.`,
    },
    {
      q: "Vous vous déplacez où ?",
      a: areaServed.length > 0
        ? `Nous intervenons sur ${areaServed.join(", ")}. L'opérateur vient chez vous ou sur votre lieu de travail, avec son eau et son matériel.`
        : `Nous intervenons sur ${BUSINESS.area}. L'opérateur vient chez vous ou sur votre lieu de travail, avec son eau et son matériel.`,
    },
    ...service.options.map((link) => ({
      q: optionQuestion(link.option.name),
      a: `Oui, c'est une option à ${euros(link.option.priceCents)}, qui ajoute environ ${link.option.durationMin} minutes. Elle se coche à la réservation, ou se décide avec l'opérateur sur place.`,
    })),
    {
      q: "Et si mon véhicule n'est pas dans la catégorie annoncée ?",
      a: "L'opérateur le reclasse à l'arrivée. Le nouveau tarif s'affiche devant vous, et la prestation ne démarre pas tant que vous ne l'avez pas accepté.",
    },
    ...(exterior
      ? [{
          q: "Faut-il un emplacement particulier pour le lavage extérieur ?",
          a: "Oui. La carrosserie se lave sur une place accessible, où l'eau peut s'écouler. Un parking souterrain sans évacuation ne convient pas — dites-le nous à la réservation, on adapte.",
        }]
      : []),
  ];

  const base = siteUrl();

  return (
    <>
      <JsonLd
        data={[
          serviceSchema(
            {
              name: service.name,
              description: service.description,
              lowestPriceCents: cheapest.pricing!.priceCents,
            },
            areaServed,
          ),
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: `${base}/` },
              { "@type": "ListItem", position: 2, name: service.name, item: `${base}/${service.slug}` },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: questions.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          },
        ]}
      />

      {/* ── Le résultat attendu ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_12%_-8%,rgb(123_60_255/0.14),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-28 sm:pt-32 lg:pb-20 lg:pt-36">
          <nav aria-label="Fil d'Ariane" className="text-meta text-xd-text-4">
            <Link href="/" className="transition-colors hover:text-xd-text-2">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <span className="text-xd-text-3">{service.name}</span>
          </nav>

          <h1 className="eyebrow mt-8 text-xd-violet-highlight">
            {interior && exterior
              ? `Nettoyage intérieur et extérieur à ${BUSINESS.city}`
              : interior
                ? `Nettoyage intérieur de voiture à ${BUSINESS.city}`
                : `Lavage extérieur de voiture à ${BUSINESS.city}`}
          </h1>

          <p className="mt-5 max-w-3xl text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.035em] text-xd-text sm:text-[3.2rem]">
            {service.name}
          </p>
          {service.description && (
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-xd-text-2">
              {service.description}
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <p className="tabular text-[2.2rem] font-semibold leading-none tracking-[-0.03em] text-xd-text">
                {euros(cheapest.pricing!.priceCents)}
              </p>
              <p className="mt-1.5 text-meta text-xd-text-3">
                {variesByVehicle
                  ? `à partir de, pour une ${cheapest.label.toLowerCase()}`
                  : "quelle que soit la voiture"}
              </p>
            </div>
            <div className="hidden h-10 w-px bg-black/[0.055] sm:block" />
            <div>
              <p className="tabular text-[2.2rem] font-semibold leading-none tracking-[-0.03em] text-xd-text">
                {formatDuration(shortest)}
              </p>
              <p className="mt-1.5 text-meta text-xd-text-3">
                à {formatDuration(longest)} sur place
              </p>
            </div>
          </div>

          <Link
            href={`/reserver?prestation=${service.id}`}
            className="press mt-9 inline-flex rounded-full bg-xd-violet px-7 py-3.5 text-body font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight"
          >
            Voir les créneaux
          </Link>
        </div>
      </section>

      {/* ── Ce qui est réellement traité ────────────────────────────────── */}
      <section className="border-y border-black/[0.08] bg-xd-abyss/60">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.4rem]">
            Ce qui est compris.
          </h2>
          <ul className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2">
            {service.includes.map((item) => (
              <li key={item} className="flex gap-3 text-body text-xd-text-2">
                <span
                  aria-hidden
                  className="mt-[10px] size-1 shrink-0 rounded-full bg-xd-violet-highlight"
                />
                {item}
              </li>
            ))}
          </ul>

          {service.options.length > 0 && (
            <>
              <h3 className="mt-14 text-h2 font-semibold tracking-[-0.02em] text-xd-text">
                En option
              </h3>
              <p className="mt-2 max-w-xl text-meta text-xd-text-3">
                À cocher à la réservation, ou à décider avec l&apos;opérateur sur place.
              </p>
              <ul className="mt-5 grid gap-px overflow-hidden rounded-[--radius-xd-xl] bg-black/[0.05] sm:grid-cols-2">
                {service.options.map((link) => (
                  <li
                    key={link.optionId}
                    className="flex items-baseline justify-between gap-4 bg-xd-carbon px-5 py-4"
                  >
                    <span className="text-body text-xd-text-2">{link.option.name}</span>
                    <span className="tabular shrink-0 text-body font-medium text-xd-text">
                      + {euros(link.option.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <CarZones
        formulas={formulas}
        title="Sur quelles parties du véhicule."
        lead="Touchez une zone pour savoir ce qui y est fait dans cette formule."
      />

      {/* ── Le tarif par véhicule ───────────────────────────────────────── */}
      {/*
        Masqué tant que le prix ne dépend pas du véhicule : sept lignes portant le
        même montant ne renseignent personne et laissent croire au contraire.
      */}
      {variesByVehicle && (
        <section className="border-y border-black/[0.08] bg-xd-abyss/60">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
            <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.4rem]">
              Le prix, par catégorie.
            </h2>
            <p className="mt-4 max-w-xl text-body text-xd-text-3">
              Prix ferme. Il dépend de la taille du véhicule, pas de son état.
            </p>

            <ul className="mt-8 grid gap-px overflow-hidden rounded-[--radius-xd-xl] bg-black/[0.05] sm:grid-cols-2 lg:grid-cols-4">
              {prices.map((row) => (
                <li key={row.key} className="bg-xd-carbon px-5 py-5">
                  <p className="text-meta text-xd-text-3">{row.label}</p>
                  <p className="tabular mt-1.5 flex items-baseline gap-2 text-h2 font-semibold tracking-[-0.025em] text-xd-text">
                    {euros(row.pricing!.priceCents)}
                    {row.pricing!.compareAtCents && (
                      <span className="text-meta font-normal text-xd-text-4 line-through">
                        {euros(row.pricing!.compareAtCents)}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-meta text-xd-text-4">
                    {formatDuration(row.pricing!.durationMin)} sur place
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Method shortestMin={shortest} longestMin={longest} />

      {/* ── Les questions qu'on nous pose ───────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <h2 className="max-w-2xl text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-xd-text sm:text-[2.4rem]">
          Ce qu&apos;on nous demande.
        </h2>
        <dl className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {questions.map((item) => (
            <div key={item.q}>
              <dt className="text-h3 font-semibold text-xd-text">{item.q}</dt>
              <dd className="mt-2 text-body leading-relaxed text-xd-text-2">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

/** Transforme un nom d'option en question telle qu'un client la pose. */
function optionQuestion(optionName: string): string {
  const normalized = optionName.toLowerCase();
  if (normalized.includes("poil")) return "Pouvez-vous enlever les poils d'animaux ?";
  if (normalized.includes("siège")) return "Les sièges sont-ils shampouinés ?";
  if (normalized.includes("plastique")) return "Pouvez-vous raviver les plastiques ternis ?";
  if (normalized.includes("jante")) return "Les jantes sont-elles traitées en profondeur ?";
  if (normalized.includes("coffre")) return "Le coffre est-il compris ?";
  return `Proposez-vous ${optionName.toLowerCase()} ?`;
}
