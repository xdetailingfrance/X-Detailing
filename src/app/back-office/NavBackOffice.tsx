"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoMarque from "@/components/accueil/LogoMarque";
import type { Icone } from "@/lib/rubriques";
import LogoutButton from "./LogoutButton";

export type LienNav = { href: string; libelle: string; icone: Icone; groupe: string; bientot?: boolean };

// Tracés des pictogrammes (24 × 24, trait).
const ICONES: Record<Icone, string> = {
  accueil: "M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  crm: "M4 19V9m6 10V5m6 14v-7m4 7H2",
  meta: "M3 12c2-6 6-6 9 0s7 6 9 0M3 12c2 6 6 6 9 0",
  clients: "M16 19v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6zM20 19v-1a3 3 0 00-2-2.8M4 19v-1a3 3 0 012-2.8",
  devis: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  reservations: "M8 3v3m8-3v3M4 8h16M5 5h14v15H5zM9 13l2 2 4-4",
  planning: "M4 5h16v15H4zM4 10h16M9 5v15M15 5v15",
  operateurs: "M12 12a4 4 0 100-8 4 4 0 000 8zM5 21v-1a7 7 0 0114 0v1",
  gps: "M12 21s7-6.3 7-12a7 7 0 10-14 0c0 5.7 7 12 7 12zM12 11a2 2 0 100-4 2 2 0 000 4z",
  interventions: "M9 11l2 2 4-4M5 4h14v16H5z",
  facturation: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  comptabilite: "M5 3h14v18H5zM8 7h8M8 11h2m3 0h3M8 15h2m3 0h3M8 19h2",
  depenses: "M3 7h18v12H3zM3 11h18M7 15h3",
  marketing: "M3 11v2l13 5V6zM16 9a3 3 0 010 6M6 13l1 6h3l-1-5",
  automatisations: "M13 3L5 14h6l-1 7 8-11h-6z",
  lola: "M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 10c5 2 12 2 17 0",
  rapports: "M4 20V10m6 10V4m6 16v-8m4 8H2",
  parametres: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 000-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
};

function Picto({ icone }: { icone: Icone }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONES[icone]} />
    </svg>
  );
}

function estActif(pathname: string, href: string) {
  return href === "/back-office" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

// Navigation du back-office : menu latéral par groupes sur ordinateur,
// barre du haut + tiroir sur téléphone.
export default function NavBackOffice({
  liens,
  email,
  role,
  espaceOperateur,
  nouveauRdv,
}: {
  liens: LienNav[];
  email: string;
  role: string;
  espaceOperateur: boolean;
  nouveauRdv: boolean;
}) {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  // Le tiroir se referme à chaque changement de page.
  const [cheminOuverture, setCheminOuverture] = useState(pathname);
  if (ouvert && cheminOuverture !== pathname) {
    setOuvert(false);
    setCheminOuverture(pathname);
  }

   const groupes = [...new Set(liens.map((l) => l.groupe))];

   const logo = (
     <div className="flex items-center gap-2.5">
       <LogoMarque className="h-10 w-10" />
       <div className="leading-tight">
         <p className="text-sm font-semibold tracking-wide">X Detailing</p>
         <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Back-office</p>
       </div>
     </div>
   );

   const menu = (
     <>
       {nouveauRdv && (
         <Link
           href="/back-office/rendez-vous/nouveau"
           onClick={() => setOuvert(false)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_-12px_var(--accent)] transition hover:bg-[var(--accent-2)]"
        >
          <span className="text-lg leading-none">+</span> Nouvelle réservation
        </Link>
      )}
      <nav className="flex flex-col gap-4">
        {groupes.map((groupe) => (
          <div key={groupe} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]/70">{groupe}</p>
            {liens
              .filter((l) => l.groupe === groupe)
              .map((lien) => {
                const actif = estActif(pathname, lien.href);
                return (
                  <Link
                    key={lien.href}
                    href={lien.href}
                    onClick={() => setOuvert(false)}
                    aria-current={actif ? "page" : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition${
                      actif ? "bg-[var(--accent)]/12 text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {actif && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--accent)]" />}
                    <span className={actif ? "text-[var(--accent-clair)]" : ""}>
                      <Picto icone={lien.icone} />
                    </span>
                    <span className="truncate">{lien.libelle}</span>
                    {lien.bientot && <span className="ml-auto rounded-full border border-[var(--border)] px-1.5 text-[9px] uppercase tracking-wide text-[var(--muted)]">bientôt</span>}
                  </Link>
                );
              })}
          </div>
        ))}
        {espaceOperateur && (
          <Link href="/operateur" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--accent-clair)] transition hover:bg-white/[0.04]">
            <Picto icone="operateurs" /> Mon espace opérateur
          </Link>
        )}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t border-[var(--border)] pt-3">
        <p className="truncate px-3 text-xs text-[var(--muted)]">{email}</p>
        <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]/70">{role}</p>
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Ordinateur */}
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col gap-5 overflow-y-auto border-r border-[var(--border)] bg-[#0d0d13] p-4 md:flex">
        <div className="px-1">{logo}</div>
        {menu}
      </aside>

      {/* Téléphone */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] bg-[#0d0d13]/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/back-office">{logo}</Link>
        <button
          type="button"
          onClick={() => {
            setCheminOuverture(pathname);
            setOuvert(true);
          }}
          aria-label="Ouvrir le menu"
          aria-expanded={ouvert}
          className="rounded-md p-2 hover:bg-[var(--surface-2)]"
        >
             <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>
      {ouvert && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/60" onClick={()=> setOuvert(false)} />
          <div className="menu-tiroir absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-5 overflow-y-auto border-r border-[var(--border)] bg-[#0d0d13] p-4">
            <div className="flex items-center justify-between px-1">
              {logo}
              <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer le menu" className="rounded-md p-2 hover:bg-[var(--surface-2)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {menu}
          </div>
        </div>
      )}
    </>
  );
}

