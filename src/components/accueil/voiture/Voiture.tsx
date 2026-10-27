// Voiture de démonstration X Detailing (berline générique, sans marque ni
// marquage officiel), dessinée en SVG pour les scènes de la page d'accueil.
// Calques : carrosserie, habitacle (sous la porte), porte avant séparée
// (elle pivote en 3D), roues (elles tournent quand la voiture roule),
// reflet au sol. Les états (porte ouverte, saleté, roulage…) sont pilotés
// par des classes CSS sur le conteneur (voiture.css).

const CARROSSERIE =
  "M48 300 C40 282 42 262 58 252 C90 236 150 228 230 222 C300 216 360 208 405 198 C455 160 505 128 560 118 C640 106 720 110 780 128 C830 142 880 170 920 196 C950 202 962 214 962 232 C962 262 958 286 948 304 L920 318 L848 318 C846 268 815 232 775 232 C735 232 704 268 702 318 L288 318 C286 268 255 232 215 232 C175 232 144 268 142 318 L70 318 C58 314 50 308 48 300 Z";
const VITRES =
  "M418 204 C462 168 512 138 566 130 C640 120 716 124 772 140 C812 152 846 172 872 194 C760 198 560 202 418 204Z";
const PORTE = "M372 210 L640 206 L642 316 L352 316 C346 280 354 240 372 210 Z";
const VITRE_PORTE = "M418 204 C462 168 512 138 566 130 C595 126 620 124 640 123 L640 205 Z";

// Poussière et salissures : particules dispersées (générateur déterministe,
// identique au rendu serveur et client).
function particules(graine: number, x: number, y: number, l: number, h: number, n: number) {
  let etat = graine;
  const alea = () => {
    etat = (etat * 16807) % 2147483647;
    return (etat - 1) / 2147483646;
  };
  return Array.from({ length: n }, (_, i) => (
    <circle
      key={i}
      cx={(x + alea() * l).toFixed(1)}
      cy={(y + alea() * h).toFixed(1)}
        r={(0.5 + alea() * alea() * 2.4).toFixed(2)}
        fill={alea() > 0.5 ? "#a49db1" : "#77708a"}
        fillOpacity={(0.35 + alea() * 0.55).toFixed(2)}
      />
    ));
}

function Roue({ cx, id }: { cx: number; id: string }) {
  return (
    <g>
      <circle cx={cx} cy={300} r={62} fill="#030304" />
      <circle cx={cx} cy={300} r={66} fill="none" stroke="#000" strokeWidth={6} />
      <circle cx={cx} cy={300} r={58} fill="none" stroke="#1d1b24" strokeWidth={3} />
      <g className="voiture-jante" style={{ transformOrigin: `${cx}px 300px` }}>
        <circle cx={cx} cy={300} r={42} fill={`url(#${id}-jante)`} />
        {[0, 72, 144, 216, 288].map((a) => (
          <rect
            key={a}
            x={cx - 4.5}
            y={262}
            width={9}
            height={36}
            rx={3}
            fill="#0c0b10"
            transform={`rotate(${a} ${cx} 300)`}
          />
        ))}
        <circle cx={cx} cy={300} r={9} fill="#16141c" stroke="#3a3446" strokeWidth={1.5} />
      </g>
    </g>
  );
}

export default function Voiture({ id = "voiture", className = "" }: { id?: string; className?: string }) {
  const defs = (
    <defs>
      <linearGradient id={`${id}-peinture`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a2433" />
        <stop offset="0.35" stopColor="#141119" />
        <stop offset="0.7" stopColor="#09080c" />
        <stop offset="1" stopColor="#040306" />
      </linearGradient>
      <linearGradient id={`${id}-epaule`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.25" stopColor="#e9e2ff" stopOpacity="0.55" />
        <stop offset="0.6" stopColor="#b98cff" stopOpacity="0.35" />
        <stop offset="1" stopColor="#9b5cf6" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-contour`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#b26bff" stopOpacity="0.9" />
        <stop offset="0.5" stopColor="#9b5cf6" stopOpacity="0.25" />
        <stop offset="1" stopColor="#b26bff" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id={`${id}-vitre`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#2b2340" />
        <stop offset="0.45" stopColor="#0d0b14" />
        <stop offset="1" stopColor="#05040a" />
      </linearGradient>
      <radialGradient id={`${id}-jante`}>
        <stop offset="0" stopColor="#3a3646" />
        <stop offset="0.55" stopColor="#1b1922" />
        <stop offset="0.86" stopColor="#2c2935" />
        <stop offset="0.95" stopColor="#8f88a0" />
        <stop offset="1" stopColor="#3b3745" />
      </radialGradient>
      <linearGradient id={`${id}-siege`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2c2638" />
        <stop offset="1" stopColor="#120f18" />
      </linearGradient>
      <linearGradient id={`${id}-propre`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.5" stopColor="#d8c2ff" stopOpacity="0.5" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={`${id}-clip-porte`}>
        <path d={PORTE} />
        <path d={VITRE_PORTE} />
      </clipPath>
      <linearGradient id={`${id}-softbox`} x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
         <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.06" />
         <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.13" />
         <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
         <stop offset="0.72" stopColor="#b98cff" stopOpacity="0.08" />
         <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
       </linearGradient>
       <clipPath id={`${id}-clip-vitres`}>
         <path d={VITRES} />
       </clipPath>
       <clipPath id={`${id}-clip-caisse`}>
         <path d={CARROSSERIE} />
       </clipPath>
     </defs>
   );

   return (
     <div className={`voiture ${className}`} aria-hidden="true">
       <div className="voiture-reflet-sol">
         <svg viewBox="0 0 1000 400">
           <use href={`#${id}-forme`} />
         </svg>
       </div>

            <svg className="voiture-caisse" viewBox="0 0 1000 400">
              {defs}
              <g id={`${id}-forme`}>
                <path d={CARROSSERIE} fill={`url(#${id}-peinture)`} />
                {/* Reflet de la boîte à lumière du studio sur la carrosserie */}
                <path d={CARROSSERIE} fill={`url(#${id}-softbox)`} />
                <path d={VITRES} fill={`url(#${id}-vitre)`} />
                <g clipPath={`url(#${id}-clip-vitres)`}>
                  <path d="M520 100 L580 100 L470 220 L410 220 Z" fill="#ffffff" fillOpacity="0.07" />
                  <path d="M600 100 L622 100 L512 220 L490 220 Z" fill="#ffffff" fillOpacity="0.05" />
                  <path d="M780 100 L840 100 L760 220 L700 220 Z" fill="#c9a6ff" fillOpacity="0.06" />
                </g>
                <path d="M638 124 L648 124 L648 205 L638 205 Z" fill="#040306" />
                <Roue cx={215} id={id} />
                <Roue cx={775} id={id} />
              </g>

        {/* Habitacle, visible quand la porte s'ouvre */}
        <g className="voiture-habitacle" clipPath={`url(#${id}-clip-porte)`}>
          <rect x="340" y="110" width="310" height="215" fill="#07060a" />
          {/* Planche de bord, volant, sièges, tapis */}
          <path d="M372 214 C430 204 520 198 638 196 L640 214 L372 222 Z" fill="#141119" />
          <path d="M392 206 C404 176 424 164 446 164" fill="none" stroke="#3c3448" strokeWidth="8" strokeLinecap="round" />
          <path
            className="voiture-siege"
            d="M560 150 C582 140 610 142 622 154 C634 168 634 216 628 254 L600 260 C596 228 588 200 566 188 C552180 548 160 560 150 Z"
            fill={`url(#${id}-siege)`}
          />
          <path
            className="voiture-siege"
            d="M498 254 C534 242 590 242 628 254 C640 272 634 288 620 294 L504 294 C488 286 486 266 498 254 Z"
            fill={`url(#${id}-siege)`}
          />
          <path d="M566 158 C590 152 610 156 618 168" fill="none" stroke="#9b5cf6" strokeOpacity="0.35" strokeWidth="2" />
          <rect className="voiture-tapis" x="384" y="296" width="250" height="14" rx="4" fill="#100d15" />
          <g className="voiture-poussiere">
            <ellipse cx="560" cy="272" rx="44" ry="10" fill="#8d8698" fillOpacity="0.14" />
            <ellipse cx="600" cy="196" rx="16" ry="30" fill="#8d8698" fillOpacity="0.1" />
            <ellipse cx="500" cy="304" rx="70" ry="6" fill="#8d8698" fillOpacity="0.16" />
            {particules(7, 500, 150, 130, 140, 70)}
            {particules(13, 386, 294, 250, 16, 60)}
          </g>
          <rect className="voiture-propre" x="340" y="110" width="310" height="215" fill={`url(#${id}-propre)`} />
          {/* Microfibre du nettoyage intérieur */}
          <g className="voiture-tampon">
            <rect x="-26" y="-14" width="52" height="28" rx="9" fill="#e9e2ff" fillOpacity="0.9" />
            <rect x="-26" y="-14" width="52" height="28" rx="9" fill="none" stroke="#9b5cf6" strokeWidth="2" />
          </g>
          <path d="M372 218 L640 212" stroke="#9b5cf6" strokeOpacity="0.55" strokeWidth="1.5" />
        </g>

             {/* Saleté de carrosserie (avant/après du lavage extérieur) */}
             <g className="voiture-salete" clipPath={`url(#${id}-clip-caisse)`}>
               <rect x="30" y="100" width="940" height="225" fill="#5a5262" opacity="0.22" />
               <path d="M60 300 C300 290 700 292 950 300 L950 320 L60 320 Z" fill="#6f6879" opacity="0.25" />
               {particules(21, 40, 110, 920, 210, 260)}
             </g>

        {/* Lumières de studio sur la carrosserie */}
        <path d="M110 246 C300 226 520 218 700 214 C800 212 880 210 930 214" fill="none" stroke={`url(#${id}-epaule)`} strokeWidth="2.5" />
        <path d="M300 276 C450 271 600 270 700 272" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="1.5" />
        <path className="voiture-contour" d={CARROSSERIE} fill="none" stroke={`url(#${id}-contour)`} strokeWidth="1.6" />
        <path d="M644 206 L646 316" stroke="#000" strokeOpacity="0.6" strokeWidth="1.5" />
        <path d="M60 256 C90 245 130 239 172 237" className="voiture-phare" fill="none" strokeWidth="4" strokeLinecap="round" />
        <path d="M908 204 C932 207 950 214 960 224" className="voiture-feu" fill="none" strokeWidth="4" strokeLinecap="round" />
        {/* Microfibre du lavage extérieur */}
        <g className="voiture-tampon-ext">
          <rect x="-34" y="-16" width="68" height="32" rx="10" fill="#e9e2ff" fillOpacity="0.92" />
          <rect x="-34" y="-16" width="68" height="32" rx="10" fill="none" stroke="#9b5cf6" strokeWidth="2" />
        </g>
        <rect className="voiture-balayage" x="-200" y="100" width="160" height="225" fill={`url(#${id}-propre)`}clipPath={`url(#${id}-clip-caisse)`} />
      </svg>

            {/* Porte avant : calque séparé qui pivote sur sa charnière */}
            <div className="voiture-porte">
              <svg viewBox="0 0 1000 400">
                <path d={PORTE} fill={`url(#${id}-peinture)`} stroke="#000" strokeOpacity="0.55" strokeWidth="1.5" />
                <path d={VITRE_PORTE} fill={`url(#${id}-vitre)`} />
                <path d={PORTE} fill={`url(#${id}-softbox)`} />
                <path d="M376 230 C480 222 580 218 640 217" fill="none" stroke={`url(#${id}-epaule)`} strokeWidth="2.5"/>
            <rect x="584" y="236" width="38" height="6" rx="3" fill="#2d2836" stroke="#4b4459" strokeWidth="1" />
            <path d="M408 200 L430 190 L436 204 L412 208 Z" fill="#141119" />
          </svg>
        </div>
      </div>
    );
}

