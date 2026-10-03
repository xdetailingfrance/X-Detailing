import { prisma } from "@/server/db";
import { DemoRibbon } from "@/components/demo-ribbon";
import { FloatingNav, StickyBookBar } from "./nav";
import { Footer } from "./footer";

/**
 * Coque du site client.
 *
 * Le contenu passe sous une navigation flottante plutôt que sous une barre pleine :
 * le premier écran garde toute sa hauteur, et l'action de réservation reste atteignable
 * sans remonter.
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  // La zone réellement couverte, telle qu'elle est configurée : c'est un signal de
  // pertinence locale, et il doit venir de la base plutôt que d'une liste recopiée.
  const sectors = await prisma.sector.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    select: { name: true },
  });

  return (
    // `color-scheme: dark` : sans lui, cases à cocher et sélecteurs de date sont
    // rendus en clair par le navigateur, au milieu d'une page noire.
    <div className="flex min-h-dvh flex-col bg-xd-void text-xd-text [color-scheme:dark]">
      <FloatingNav />
      <main className="flex-1">{children}</main>
      <Footer sectors={sectors.map((sector) => sector.name)} />
      <StickyBookBar />
      <DemoRibbon />
    </div>
  );
}
