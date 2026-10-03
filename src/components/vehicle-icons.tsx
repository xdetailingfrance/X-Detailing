/**
 * Silhouettes de véhicule.
 *
 * Dessinées au trait, dans la même langue graphique que le schéma des zones : une
 * icône générique posée dans un carré arrondi ne dit pas si l'on parle d'un break ou
 * d'un monospace, alors que c'est exactement ce que le visiteur doit trancher.
 *
 * Les sept profils se distinguent par leur proportion — longueur, hauteur de toit,
 * porte-à-faux arrière — et pas par un détail décoratif : c'est ce qui reste lisible
 * à 40 px.
 */

type Props = { className?: string };

/** Cadre commun : mêmes roues, même sol, même épaisseur de trait. */
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

export function IconBreak({ className }: Props) {
  return (
    <Silhouette
      className={className}
      body="M3 21 C2 16 4 14 8 13.5 L17 13.5 L24 6.5 Q25 5.5 27 5.5 L48 5.5 Q50 5.5 51 7 L52 13.5 L58 14 C61 14.5 62 16.5 61 21 Z"
      glass="M19 13 L25.5 7.3 L48 7.3 L49.5 13 Z"
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

export function IconQuatreQuatre({ className }: Props) {
  return (
    <Silhouette
      className={className}
      body="M4 20 C3 14 5 11.5 9 11 L17 11 L21 3.5 Q22 2.5 24 2.5 L46 2.5 Q48 2.5 49 4 L51 11 L57 11.5 C61 12 62 14 61 20 Z"
      glass="M18.5 10.5 L22.5 4.3 L46 4.3 L48 10.5 Z"
    />
  );
}

export function IconUtilitaire({ className }: Props) {
  return (
    <Silhouette
      className={className}
      body="M3 21 C2 16 4 13.5 8 13 L15 13 L20 5 Q21 4 23 4 L57 4 Q60 4 60.5 6.5 L61 21 Z"
      glass="M17 12.5 L21.5 5.8 L33 5.8 L33 12.5 Z"
    />
  );
}

export function IconSeptPlaces({ className }: Props) {
  return (
    <Silhouette
      className={className}
      body="M3 21 C2 15 4 12 8 11 L14 10.5 L23 4 Q24.5 3 27 3 L48 3 Q51 3 52.5 5 L55 11 L58 12 C61 13 62 15.5 61 21 Z"
      glass="M16.5 10.5 L24 4.8 L48 4.8 L51 10.5 Z"
    />
  );
}

/** Le pictogramme correspondant à une classe de véhicule. */
export const VEHICLE_ICON: Record<string, (props: Props) => React.ReactElement> = {
  CITADINE: IconCitadine,
  BERLINE: IconBerline,
  BREAK: IconBreak,
  SUV: IconSuv,
  QUATRE_X_QUATRE: IconQuatreQuatre,
  UTILITAIRE: IconUtilitaire,
  SEPT_PLACES: IconSeptPlaces,
};
