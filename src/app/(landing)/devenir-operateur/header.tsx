"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * En-tête collant et menu (§5).
 *
 * Le menu se ferme au clic sur une entrée : sur mobile, un panneau qui reste ouvert
 * masque la section qu'on vient de demander.
 */

const LINKS = [
  { href: "#video", label: "La vidéo" },
  { href: "#decouvrir", label: "Découvrir X Detailing" },
  { href: "#chiffres", label: "Chiffres clés" },
  { href: "#pourquoi", label: "Pourquoi X Detailing ?" },
  { href: "#temoignages", label: "Témoignages" },
];

export function LandingHeader({ showTestimonials }: { showTestimonials: boolean }) {
  const [open, setOpen] = useState(false);
  const links = showTestimonials ? LINKS : LINKS.filter((l) => l.href !== "#temoignages");

  return (
    <header className="sticky top-0 z-50 border-b border-[#1c1c25] bg-[rgb(7_7_10_/_0.94)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[480px] items-center justify-between px-5 lg:max-w-[1100px]">
        <Link href="#video" className="flex items-baseline gap-1.5" aria-label="X Detailing">
          {/* Le logo officiel prendra la place de ce lettrage quand il sera fourni. */}
          <span className="lp-display text-[26px] font-bold leading-none text-[color:var(--lp-logo-x)]">
            X
          </span>
          <span className="lp-display text-[13px] font-medium uppercase leading-none tracking-[0.32em] text-[color:var(--lp-logo-word)]">
            Detailing
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-2 text-[14px] text-[color:var(--lp-body)] transition-colors hover:text-[color:var(--lp-text)]"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/candidature"
              className="lp-metal ml-2 rounded-[14px] px-4 py-2.5 text-[13px] font-extrabold uppercase tracking-[0.1em]"
            >
              Devenir opérateur →
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            aria-controls="lp-menu"
            className="grid size-11 place-items-center rounded-xl border border-[#2a2a36] lg:hidden"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={`absolute inset-x-0 top-0 h-[1.6px] rounded bg-[color:var(--lp-text)] transition-transform ${open ? "translate-y-[6px] rotate-45" : ""}`}
              />
              <span
                className={`absolute inset-x-0 top-[6px] h-[1.6px] rounded bg-[color:var(--lp-text)] transition-opacity ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute inset-x-0 top-3 h-[1.6px] rounded bg-[color:var(--lp-text)] transition-transform ${open ? "-translate-y-[6px] -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="lp-menu"
          className="border-t border-[#1c1c25] bg-[rgb(7_7_10_/_0.98)] lg:hidden"
        >
          <div className="mx-auto max-w-[480px] px-5 py-2">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[54px] items-center justify-between border-b border-[#1c1c25] text-[15px] text-[color:var(--lp-text)]"
              >
                {link.label}
                <span aria-hidden className="text-[color:var(--lp-accent)]">
                  →
                </span>
              </a>
            ))}
            <Link
              href="/candidature"
              onClick={() => setOpen(false)}
              className="lp-metal mt-4 mb-3 flex h-[52px] items-center justify-center rounded-[16px] text-[15px] font-extrabold uppercase tracking-[0.1em]"
            >
              Devenir opérateur →
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

/** Bouton fixe en bas (§7.10) — visible sur toute la page, ne masque rien. */
export function StickyApply() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40"
      style={{
        background:
          "linear-gradient(180deg, transparent 0%, rgb(7 7 10 / 0.92) 45%, #07070a 100%)",
        padding: "28px 16px calc(14px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-[480px]">
        <Link
          href="/candidature"
          className="lp-metal lp-metal-fixed flex h-[58px] items-center justify-center rounded-[16px] text-[15px] font-extrabold uppercase tracking-[0.1em]"
        >
          Rejoindre X Detailing →
        </Link>
      </div>
    </div>
  );
}
