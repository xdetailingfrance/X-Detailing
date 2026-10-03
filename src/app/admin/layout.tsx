import { DemoRibbon } from "@/components/demo-ribbon";
import Image from "next/image";
import Link from "next/link";
import { requireBackOffice } from "@/lib/auth/guard";
import { signOut } from "@/app/connexion/actions";
import { NavLink, NavToggle } from "./nav";
import {
  IconAlert, IconAutomation, IconBuilding, IconChart, IconCustomer, IconDashboard, IconExit, IconLead, IconMap, IconOperator, IconPayout, IconPlanning, IconPlus, IconQuote, IconSettings,
} from "@/components/icons";

/**
 * Coque du back-office (§25, §40).
 *
 * Onze destinations ne tiennent pas dans une barre horizontale : elles débordaient sur
 * trois lignes. Une colonne latérale les regroupe par intention — piloter, vendre,
 * animer le réseau, régler le système — ce qui rend la navigation parcourable au lieu
 * d'être une liste à lire.
 *
 * §40 : état actif discret. Pas de gros aplat violet derrière l'élément courant, mais
 * un filet lumineux et un contraste typographique.
 */

const SECTIONS = [
  {
    label: "Piloter",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: IconDashboard, exact: true },
      { href: "/admin/planning", label: "Planning", icon: IconPlanning },
      { href: "/admin/carte", label: "Carte du réseau", icon: IconMap },
      { href: "/admin/statistiques", label: "Statistiques", icon: IconChart },
    ],
  },
  {
    label: "Clientèle",
    items: [
      { href: "/admin/devis", label: "Devis express", icon: IconQuote },
      { href: "/admin/rendez-vous/nouveau", label: "Nouveau rendez-vous", icon: IconPlus },
      { href: "/admin/clients", label: "Clients", icon: IconCustomer },
      { href: "/admin/entreprises", label: "Entreprises", icon: IconBuilding },
      { href: "/admin/leads", label: "Leads", icon: IconLead },
    ],
  },
  {
    label: "Réseau",
    items: [
      { href: "/admin/operateurs", label: "Opérateurs", icon: IconOperator },
      { href: "/admin/reversements", label: "Reversements", icon: IconPayout },
      { href: "/admin/impayes", label: "Impayés", icon: IconAlert },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/admin/automatisations", label: "Automatisations", icon: IconAutomation },
      { href: "/admin/reglages", label: "Réglages", icon: IconSettings },
    ],
  },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireBackOffice();

  return (
    <div className="min-h-dvh bg-xd-void lg:grid lg:grid-cols-[248px_1fr]">
      {/* ── Colonne de navigation ──────────────────────────────────────── */}
      <aside
        id="admin-nav"
        className="m-smoked hidden flex-col lg:sticky lg:top-0 lg:flex lg:h-dvh"
      >
        <div className="px-5 pb-6 pt-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[--radius-xd-xs] bg-xd-void">
              <Image src="/marque/x-mark.png" alt="" width={512} height={364} className="h-4 w-auto" />
            </span>
            <span className="text-body font-semibold tracking-[-0.02em] text-xd-text">
              X Detailing
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {SECTIONS.map((section) => (
            <div key={section.label} className="mb-5">
              <p className="eyebrow px-3 pb-2 text-xd-text-4">{section.label}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink href={item.href} exact={"exact" in item ? item.exact : false}>
                      <item.icon className="size-[17px]" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hairline-t px-5 py-4">
          <p className="truncate text-meta text-xd-text-2">{user.name}</p>
          <p className="truncate text-meta text-xd-text-4">{user.email}</p>
          <form action={signOut} className="mt-3">
            <button
              type="submit"
              className="press inline-flex items-center gap-2 text-meta text-xd-text-3 transition-colors hover:text-xd-text"
            >
              <IconExit className="size-4" />
              Quitter
            </button>
          </form>
        </div>
      </aside>

      {/* ── Barre mobile ───────────────────────────────────────────────── */}
      <header className="m-smoked sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-[--radius-xd-xs] bg-xd-void">
            <Image src="/marque/x-mark.png" alt="" width={512} height={364} className="h-3.5 w-auto" />
          </span>
          <span className="text-meta font-semibold text-xd-text">X Detailing</span>
        </Link>
        <NavToggle sections={SECTIONS.map((s) => ({ label: s.label, items: [...s.items].map((i) => ({ href: i.href, label: i.label })) }))} />
      </header>

      <main className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      <DemoRibbon />
    </div>
  );
}
