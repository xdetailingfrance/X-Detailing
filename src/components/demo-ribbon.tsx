import Link from "next/link";
import { DEMO_ENABLED } from "@/server/demo/mode";

/**
 * Retour vers le sommaire de la démonstration.
 *
 * Sans ce repère, quelqu'un qui entre dans l'espace opérateur n'a aucun moyen évident de
 * revenir changer de point de vue : il devrait se déconnecter, ce qui ressemble à une
 * sortie plutôt qu'à un aiguillage. Discret, en bas à droite, hors du flux de lecture.
 */
export function DemoRibbon() {
  if (!DEMO_ENABLED) return null;

  // Sur mobile, la barre d'action basse du site client occupe le bas de l'écran :
  // le repère de démonstration se pose au-dessus plutôt que dessus.
  return (
    <Link
      href="/demo"
      className="fixed bottom-20 right-4 z-40 md:bottom-4 rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide text-chrome-200 m-polished hairline backdrop-blur transition duration-150 hover:text-xd-text"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      Démo · changer de rôle
    </Link>
  );
}
