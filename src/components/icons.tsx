/**
 * Jeu d'icônes X Detailing (§42).
 *
 * Trait homogène, géométrie simple, aucune icône illustrative. Les icônes restent
 * secondaires par rapport au texte : elles aident à repérer une ligne dans une liste,
 * elles ne la remplacent pas.
 *
 * Dessinées à la main plutôt qu'importées d'une librairie : « des icônes Lucide dans
 * des carrés partout » est l'un des signaux d'interface générée listés au §58.
 */

type IconProps = { className?: string };

const base = "size-[18px] shrink-0";

function Svg({ className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${base} ${className}`}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />
    </Svg>
  );
}

export function IconPlanning(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </Svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4 3.5 6.5v13L9 17l6 3 5.5-2.5v-13L15 7z" />
      <path d="M9 4v13M15 7v13" />
    </Svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** Devis : une feuille chiffrée, pas un symbole monétaire — c'est un document. */
export function IconQuote(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 3h7l4 4v14H6z" />
      <path d="M13 3v4h4" />
      <path d="M9 13h6M9 17h4" />
    </Svg>
  );
}

export function IconCustomer(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20V6l7-3v17M11 20h9V9l-9-3" />
      <path d="M7 9v.01M7 13v.01M15 12v.01M15 16v.01" />
    </Svg>
  );
}

export function IconLead(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5 12 13l8.5-5.5" />
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    </Svg>
  );
}

export function IconOperator(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 19a6.2 6.2 0 0 1 12.4 0M17 11.5a3 3 0 1 0 0-6M17.5 19a5.5 5.5 0 0 0-2-4.3" />
    </Svg>
  );
}

export function IconPayout(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M2.5 10h19M6 14.5h3" />
    </Svg>
  );
}

export function IconAutomation(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5v3M12 17.5v3M20.5 12h-3M6.5 12h-3M18 6l-2.1 2.1M8.1 15.9 6 18M18 18l-2.1-2.1M8.1 8.1 6 6" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </Svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function IconExit(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h9" />
    </Svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 8.5v4.5M12 16.5v.01" />
      <path d="M10.3 3.9 2.6 17.2A1.9 1.9 0 0 0 4.3 20h15.4a1.9 1.9 0 0 0 1.7-2.8L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" />
    </Svg>
  );
}
