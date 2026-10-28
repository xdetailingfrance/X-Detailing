import Link from "next/link";
import type { Metadata } from "next";
import LogoMarque from "@/components/accueil/LogoMarque";
import ExperiencePrestations from "@/components/accueil/ExperiencePrestations";
import Utilitaire from "@/components/accueil/voiture/Utilitaire";
import { optionsPubliques, prestationsPubliques } from "@/lib/prestationsPubliques";
import { paiementEnLigneActif } from "@/lib/paiement";
import "@/components/accueil/accueil.css";
import "@/components/accueil/voiture/voiture.css";
import "@/components/accueil/parcours.css";

export const metadata: Metadata = {
  title: "X Detailing — Le detailing automobile, directement chez vous",
  description:
    "Nettoyage intérieur et extérieur de votre véhicule à domicile ou au bureau, à Bordeaux et alentours. Opérateurs équipés, réservation simple.",
};

// Prix des packs modifiables dans le back-office : page régénérée
// régulièrement plutôt qu'à chaque visite (chargement léger).
export const revalidate = 300;

// Numéro de contact, au format international attendu par wa.me.
const TELEPHONE_WHATSAPP = "33649368328";

const TITRE = "Le detailing automobile, directement chez vous";

const ETAPES = [
  { titre: "Vous réservez", texte: "Choisissez votre formule, la date et l'adresse : domicile, bureau ou parking." },
  { titre: "Nous venons à vous", texte: "Un opérateur X Detailing arrive avec son Kangoo équipé : eau, produits, aspirateurs." },
  { titre: "Votre véhicule brille", texte: "Contrôle avant/après en photos, signature, paiement sur place ou par lien." },
];

export default async function Accueil() {
  const [prestations, options] = await Promise.all([prestationsPubliques(), optionsPubliques()]);

   return (
     <div className="site-clair flex min-h-screen flex-col overflow-x-clip">

            <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 sm:px-8 sm:py-5">
        <Link href="/" aria-label="X Detailing — accueil">
          {/* Sur fond blanc : DETAILING en noir (variante claire du logo). */}
          <LogoMarque id="logo-entete" className="h-16 w-16 sm:h-20 sm:w-20" />
        </Link>
        <nav className="flex items-center gap-4 text-xs font-medium uppercase tracking-[0.18em] text-[var(--chrome)]/80 sm:gap-8">
          <a href="#prestations" className="hidden hover:text-[var(--encre)] sm:inline">
            Prestations
          </a>
          <a href="#fonctionnement" className="hidden hover:text-[var(--encre)] sm:inline">
            Comment ça marche
          </a>
          {/*
            Appel direct par WhatsApp. `wa.me` ouvre l'application sur mobile et
            WhatsApp Web sur ordinateur ; le numéro y est attendu au format
            international sans espace ni signe plus.
          */}
          <a
            href={`https://wa.me/${TELEPHONE_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-white normal-case tracking-normal transition hover:bg-[#1ebe5b]"
          >
            <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.4-.07-.13-.27-.2-.57-.35Z" />
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.33 4.97L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.36c0-4.53 3.7-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.17 8.17 0 0 1 2.41 5.82c0 4.53-3.69 8.21-8.23 8.21Z" />
            </svg>
            Appeler
          </a>
        </nav>
      </header>

      <main>
        {/* Après l'ouverture du logo, les prestations apparaissent directement. */}
        <section id="prestations" className="relative flex min-h-[100svh] flex-col justify-center px-4 pb-16 pt-28 sm:px-8 sm:pt-32">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(155,92,246,0.12),transparent_70%)]" />
          <div className="relative mx-auto w-full max-w-6xl">
            <p
              className="entree text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--violet-vif)]"
              style={{ ["--delai" as string]: "0ms" }}
            >
              Bordeaux et alentours · à domicile
            </p>
            {/* Animation d'accueil : le titre monte mot par mot, l'utilitaire
                traverse la page et sa traînée devient le trait sous le titre. */}
            <h1 className="motion-titre mt-3 text-[1.9rem] font-semibold uppercase leading-[1.1] tracking-[0.06em] sm:text-5xl">
              {TITRE.split(" ").map((mot, i) => (
                <span key={i} className="mot">
                  <span className="texte-chrome" style={{ ["--i" as string]: i }}>
                    {mot}
                  </span>
                </span>
              ))}
            </h1>
            <div className="motion-route" aria-hidden="true">
              <span className="motion-trainee" />
              <div className="motion-van">
                <Utilitaire className="roule" />
              </div>
            </div>
            <p className="motion-sous-titre mt-4 max-w-xl text-sm text-[var(--chrome)]/65 sm:text-base">
              Choisissez votre prestation : nous venons laver votre véhicule à domicile ou au bureau.
            </p>
            <div className="mt-8 sm:mt-10">
              <ExperiencePrestations prestations={prestations} options={options} paiementEnLigne={paiementEnLigneActif()} />
            </div>
          </div>
        </section>

        <section id="fonctionnement" className="scroll-mt-6 border-t border-[var(--encre)]/5 bg-white px-5 py-20sm:px-8">
          <div className="mx-auto max-w-5xl">
            <h2 className="texte-chrome text-2xl font-semibold uppercase tracking-[0.12em] sm:text-3xl">Comment ça marche</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {ETAPES.map((e, i) => (
                <li key={e.titre} className="flex flex-col gap-2">
                  <span className="text-3xl font-semibold text-[var(--violet-vif)]">{String(i + 1).padStart(2,"0")}</span>
                  <h3 className="text-lg font-semibold text-[var(--encre)]">{e.titre}</h3>
                  <p className="text-sm leading-relaxed text-[var(--chrome)]/70">{e.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

            <footer className="border-t border-[var(--encre)]/5 bg-white px-5 py-8 text-xs text-[var(--chrome)]/50 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
            <span>© X Detailing</span>
            <span className="flex gap-6">
              <Link href="/conditions-generales" className="hover:text-[var(--encre)]">
                Conditions générales
              </Link>
            </span>
          </div>
        </footer>
      </div>
    );
}

