"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Navigation flottante (§7).
 *
 * Une capsule posée sur le contenu plutôt qu'une barre qui le surmonte. Au défilement
 * elle se resserre et son verre s'épaissit : le contenu passe dessous, on continue de
 * le voir, et l'action de réservation ne quitte jamais l'écran.
 *
 * Le repère de défilement est volontairement bas — 24 px. Plus haut, la capsule change
 * d'état pendant qu'on lit encore le premier écran, ce qui se remarque comme un défaut.
 */

const LINKS = [
  { href: "/nettoyage-interieur-voiture", label: "Intérieur" },
  { href: "/nettoyage-complet-voiture", label: "Intérieur + extérieur" },
  { href: "/realisations", label: "Réalisations" },
];

export function FloatingNav() {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        aria-label="Navigation principale"
        className={`glass pointer-events-auto flex w-full max-w-4xl items-center gap-2 rounded-full transition-all duration-[--xd-component] ${
          condensed ? "px-3 py-1.5 sm:px-4 sm:py-2" : "px-4 py-2.5 sm:px-5 sm:py-3"
        }`}
        style={condensed ? { backdropFilter: "blur(28px) saturate(170%)" } : undefined}
      >
        <Link
          href="/"
          aria-label="X Detailing — accueil"
          className="flex shrink-0 items-center gap-2.5 rounded-full"
        >
          <Image
            src="/marque/x-mark.png"
            alt=""
            width={512}
            height={364}
            priority
            className={`w-auto transition-all duration-[--xd-component] ${condensed ? "h-5" : "h-6"}`}
          />
          <span className="text-micro font-semibold uppercase tracking-[0.26em] text-xd-text-2">
            Detailing
          </span>
        </Link>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-meta text-xd-text-3 transition-colors duration-[--xd-micro] hover:text-xd-text"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/reserver"
          className="press ml-auto shrink-0 rounded-full bg-xd-violet px-4 py-2 text-meta font-semibold text-white [box-shadow:inset_0_1px_0_0_rgb(255_255_255/0.24)] transition-colors duration-[--xd-micro] hover:bg-xd-violet-highlight md:ml-0"
        >
          Réserver
        </Link>
      </nav>
    </div>
  );
}

/**
 * Barre d'action basse, mobile uniquement (§13).
 *
 * Elle n'apparaît qu'après le premier écran : posée d'emblée, elle masquerait le hero
 * sur lequel elle repose. Le pouce l'atteint sans déplacer la main.
 */
export function StickyBookBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-3 pb-3 transition-all duration-[--xd-component] md:hidden ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/reserver"
        className="glass press flex items-center justify-center gap-2 rounded-full py-3.5 text-body font-semibold text-xd-text"
      >
        Réserver mon créneau
      </Link>
    </div>
  );
}
