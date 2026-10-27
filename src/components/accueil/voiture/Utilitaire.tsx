import contour from "../contour-x.json";

// Utilitaire de service X Detailing (silhouette d'utilitaire compact type
// Kangoo, sans logo de constructeur), aux couleurs de la marque : noir
// laqué, bande violette, logo officiel X Detailing (calques découpés dans
// le fichier original) sur le panneau latéral. Les roues tournent quand il
// roule (classe .roule, voir utilitaire.css).

const CAISSE =
  "M70 330 C60 300 62 272 80 257 C110 242 160 234 212 228 C246 196 278 162 314 136 C334 116 362 102 400 100 L89898 C924 98 940 112 942 136 L948 330 C948 345 940 352 925 352 L822 352 C818 310 793 290 760 290 C727 290 702 310 698 352 L292 352 C288 310 263 290 230 290 C197 290 172 310 168 352 L90 352 C78 350 72 342 70 330 Z";
const VITRE_AVANT = "M262 214 L304 150 C322 126 346 114 384 112 L466 112 L466 214 Z";
const PARE_BRISE = "M214 226 C246 196 276 166 300 148 L262 214 Z";

function Roue({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={352} r={58} fill="#030304" />
      <circle cx={cx} cy={352} r={62} fill="none" stroke="#000" strokeWidth={6} />
      <g className="utilitaire-jante" style={{ transformOrigin: `${cx}px 352px` }}>
        <circle cx={cx} cy={352} r={36} fill="url(#utilitaire-jante)" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect key={a} x={cx - 3} y={320} width={6} height={30} rx={2} fill="#0c0b10" transform={`rotate(${a}${cx} 352)`} />
        ))}
        <circle cx={cx} cy={352} r={7} fill="#1a1820" stroke="#9b5cf6" strokeOpacity={0.6} strokeWidth={1.5} />
      </g>
      </g>
    );
}

export default function Utilitaire({ className = "" }: { className?: string }) {
  const { hauteur, bande } = contour;
  const LOGO = { x: 600, y: 112, taille: 196 };
  return (
    <div className={`utilitaire ${className}`} aria-hidden="true">
      <svg viewBox="0 0 1000 420">
        <defs>
          <linearGradient id="utilitaire-peinture" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b2534" />
            <stop offset="0.3" stopColor="#15121b" />
            <stop offset="0.75" stopColor="#09080c" />
            <stop offset="1" stopColor="#040306" />
          </linearGradient>
          <linearGradient id="utilitaire-softbox" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.07" />
            <stop offset="0.47" stopColor="#fff" stopOpacity="0.14" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="utilitaire-vitre" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2b2340" />
            <stop offset="0.5" stopColor="#0d0b14" />
            <stop offset="1" stopColor="#05040a" />
          </linearGradient>
          <linearGradient id="utilitaire-bande" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6d28d9" />
            <stop offset="0.5" stopColor="#9b5cf6" />
            <stop offset="1" stopColor="#b26bff" />
          </linearGradient>
          <radialGradient id="utilitaire-jante">
            <stop offset="0" stopColor="#3a3646" />
            <stop offset="0.6" stopColor="#1b1922" />
            <stop offset="0.92" stopColor="#8f88a0" />
            <stop offset="1" stopColor="#3b3745" />
          </radialGradient>
          <clipPath id="utilitaire-clip">
            <path d={CAISSE} />
          </clipPath>
        </defs>

        <path d={CAISSE} fill="url(#utilitaire-peinture)" />
        <path d={CAISSE} fill="url(#utilitaire-softbox)" />
        <path d={PARE_BRISE} fill="url(#utilitaire-vitre)" />
        <path d={VITRE_AVANT} fill="url(#utilitaire-vitre)" />
        <path d="M330 116 L360 116 L300 210 L270 210 Z" fill="#fff" fillOpacity="0.06" />
        {/* Montants, porte coulissante, hayon */}
        <path d="M466 110 L482 110 L482 336 L466 336 Z" fill="#050407" />
        <path d="M486 118 L486 336 M700 118 L700 290 M905 104 L908 336" stroke="#000" strokeOpacity="0.55" strokeWidth="2" />
        <path d="M486 236 L700 236" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x="440" y="232" width="20" height="5" rx="2.5" fill="#2d2836" />
        <rect x="660" y="226" width="26" height="5" rx="2.5" fill="#2d2836" />
        <path d="M290 214 L308 204 L314 222 L292 226 Z" fill="#141119" />

            {/* Habillage X Detailing : bande violette et logo officiel */}
            <g clipPath="url(#utilitaire-clip)">
              <path d="M60 300 L960 300 L960 318 L60 318 Z" fill="url(#utilitaire-bande)" opacity="0.9" />
              <path d="M60 296 L960 296" stroke="#e9e2ff" strokeOpacity="0.35" strokeWidth="1" />
            </g>
            <image href="/marque/x-640.webp" x={LOGO.x} y={LOGO.y} width={LOGO.taille} height={LOGO.taille} />
            <image
              href="/marque/detailing-640.webp"
              x={LOGO.x}
              y={LOGO.y + (bande[0] / hauteur) * LOGO.taille}
              width={LOGO.taille}
              height={((bande[1] - bande[0]) / hauteur) * LOGO.taille}
              preserveAspectRatio="none"
            />

        {/* Lumières */}
        <path d="M84 262 C110 250 150 244 190 240" className="utilitaire-phare" fill="none" strokeWidth="5" strokeLinecap="round" />
        <path d="M942 150 L944 236" className="utilitaire-feu" fill="none" strokeWidth="6" strokeLinecap="round"/>
        <path d={CAISSE} fill="none" stroke="#b26bff" strokeOpacity="0.45" strokeWidth="1.5" className="utilitaire-contour" />

          <Roue cx={230} />
          <Roue cx={760} />
        </svg>
      </div>
    );
}

