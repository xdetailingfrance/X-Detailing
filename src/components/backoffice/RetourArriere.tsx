"use client";

/**
 * Flèche de retour en haut d'une page de détail.
 *
 * Sur téléphone, l'en-tête du back-office ne montre que le logo et le menu :
 * une fois entré dans un rendez-vous depuis le planning, plus rien ne
 * ramenait en arrière.
 *
 * La destination se décide au clic, pas au rendu : si l'on vient d'une page
 * du site, on revient réellement en arrière — et l'on retrouve le planning
 * sur la semaine qu'on regardait. Sinon, par exemple depuis un lien reçu par
 * e-mail, on va à la liste parente plutôt que de rester dans un cul-de-sac.
 */
import { useRouter } from "next/navigation";

export default function RetourArriere({ versHref, versLibelle }: { versHref: string; versLibelle: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // window.history.length ne suffit pas : un onglet neuf en a déjà
        // plusieurs. Le référent dit si l'on vient bien du site.
        if (document.referrer.startsWith(window.location.origin)) router.back();
        else router.push(versHref);
      }}
      aria-label={`Retour à ${versLibelle}`}
      className="inline-flex items-center gap-1.5 self-start rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {versLibelle}
    </button>
  );
}
