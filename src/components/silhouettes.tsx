import type { VehiculeId } from "@/lib/catalogue";

/**
 * Silhouettes de véhicule, au trait.
 *
 * Les trois profils se distinguent par leur proportion — longueur, hauteur de toit,
 * porte-à-faux arrière — et pas par un détail décoratif : c'est ce qui reste lisible
 * à 40 px.
 */

type Props = { className?: string };

function Silhouette({
  body,
  glass,
  wheels = [17, 47],
  className = "w-12",
}: {
  body: string;
  glass: string;
  wheels?: [number, number];
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 28" aria-hidden className={className} fill="none">
      <path
        d={body}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.06"
      />
      <path d={glass} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" opacity="0.55" />
      {wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="22" r="4.4" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <circle cx={cx} cy="22" r="1.5" fill="currentColor" opacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

export function IconCitadine({ className }: Props) {
  return (
    <Silhouette
      className={className}
      wheels={[15, 45]}
      body="M5 21 C4 16 6 14 10 13.5 L18 13.5 L24 7 Q25 6 27 6 L38 6 Q40 6 41 7.5 L46 13.5 L52 14 C56 14.5 57 16.5 56 21 Z"
      glass="M20 13 L25.5 7.8 L37.5 7.8 L43 13 Z"
    />
  );
}

export function IconBerline({ className }: Props) {
  return (
    <Silhouette
      className={className}
      body="M3 21 C2 16 4 14 8 13.5 L17 13.5 L24 7 Q25 6 27 6 L38 6 Q40 6 41 7.5 L47 13.5 L57 14 C61 14.5 62 16.5 61 21 Z"
      glass="M19 13 L25.5 7.8 L37.5 7.8 L44 13 Z"
    />
  );
}

export function IconSuv({ className }: Props) {
  return (
    <Silhouette
      className={className}
      body="M3 20.5 C2 15 4 12.5 8 12 L17 12 L23 5 Q24 4 26 4 L44 4 Q46 4 47 5.5 L50 12 L57 12.5 C61 13 62 15 61 20.5 Z"
      glass="M19 11.5 L24.5 5.8 L44 5.8 L47 11.5 Z"
    />
  );
}

export const VEHICULE_ICON: Record<VehiculeId, (props: Props) => React.JSX.Element> = {
  citadine: IconCitadine,
  berline: IconBerline,
  suv: IconSuv,
};
