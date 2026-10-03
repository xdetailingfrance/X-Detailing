/** Icônes de la landing : SVG en ligne, trait 1,6 px arrondi, aucune librairie (§3). */

type Props = { className?: string };

function Stroke({ children, className = "size-6" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconCalendar(props: Props) {
  return (
    <Stroke {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 14h3M14 14h2M8 17.5h5" />
    </Stroke>
  );
}

export function IconCar(props: Props) {
  return (
    <Stroke {...props}>
      <path d="M3 15v-2.2a2 2 0 0 1 .5-1.3L6 8.2A2 2 0 0 1 7.6 7.5h8.8a2 2 0 0 1 1.6.7l2.5 3.3a2 2 0 0 1 .5 1.3V15" />
      <path d="M3 15h18v2.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V15M7.5 15v2.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V15" />
      <path d="M6.5 12h11" />
    </Stroke>
  );
}

export function IconTruck(props: Props) {
  return (
    <Stroke {...props}>
      <path d="M2.5 16V7.5a1 1 0 0 1 1-1H14a1 1 0 0 1 1 1V16" />
      <path d="M15 10h3.2a1 1 0 0 1 .8.4l2.3 3a1 1 0 0 1 .2.6V16" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
      <path d="M8.8 17.5h6.9M2.5 17.5h2.7" />
    </Stroke>
  );
}

export function IconBuilding(props: Props) {
  return (
    <Stroke {...props}>
      <path d="M4 21V5.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V21" />
      <path d="M13 21V10h5.5a1 1 0 0 1 1 1v10" />
      <path d="M7 8.5h3M7 12h3M7 15.5h3M16 14h1M16 17.5h1" />
      <path d="M2.5 21h19" />
    </Stroke>
  );
}

export function IconWallet(props: Props) {
  return (
    <Stroke {...props}>
      <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
      <path d="M3.5 9.5V7a1.5 1.5 0 0 1 1.9-1.45l9.6 2.45" />
      <path d="M20 12h-3.2a1.8 1.8 0 0 0 0 3.6H20" />
    </Stroke>
  );
}

export function IconFlag(props: Props) {
  return (
    <Stroke {...props}>
      <path d="M5.5 21V3.5" />
      <path d="M5.5 4.5h10.8a.7.7 0 0 1 .55 1.13L14.5 8.5l2.35 2.87a.7.7 0 0 1-.55 1.13H5.5" />
    </Stroke>
  );
}

export function IconLayers(props: Props) {
  return (
    <Stroke {...props}>
      <path d="M12 3.5 21 8l-9 4.5L3 8z" />
      <path d="M3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5" />
    </Stroke>
  );
}

export function IconPlay(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={props.className}>
      <path d="M9 6.5v11a.6.6 0 0 0 .92.5l8.4-5.5a.6.6 0 0 0 0-1l-8.4-5.5A.6.6 0 0 0 9 6.5" />
    </svg>
  );
}
