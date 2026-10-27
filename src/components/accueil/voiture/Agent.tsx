// Agent X Detailing en tenue professionnelle (polo noir, liseré violet,
// logo officiel brodé), illustration vectorielle pour la scène finale de la
// réservation. Il salue de la main (animation dans parcours.css).
export default function Agent({ className = "" }: { className?: string }) {
  return (
    <div className={`agent ${className}`} aria-hidden="true">
      <svg viewBox="0 0 300 560">
        <defs>
          <linearGradient id="agent-polo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a3346" />
            <stop offset="0.55" stopColor="#1b1822" />
            <stop offset="1" stopColor="#08070b" />
          </linearGradient>
          <linearGradient id="agent-peau" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d9b49a" />
            <stop offset="1" stopColor="#a87d64" />
          </linearGradient>
          <linearGradient id="agent-pantalon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#15131b" />
            <stop offset="1" stopColor="#060509" />
          </linearGradient>
          <linearGradient id="agent-contre-jour" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#b26bff" stopOpacity="0.85" />
            <stop offset="0.25" stopColor="#b26bff" stopOpacity="0" />
          </linearGradient>
        </defs>

            {/* Jambes et chaussures */}
            <path d="M112 330 L104 520 L138 520 L150 360 L162 520 L196 520 L188 330 Z" fill="url(#agent-pantalon)" />
            <path d="M96 520 C96 508 106 504 140 506 L142 532 L96 532 Z" fill="#050407" />
            <path d="M160 506 C194 504 206 508 206 520 L206 532 L160 532 Z" fill="#050407" />

            {/* Bras gauche le long du corps */}
            <path d="M86 196 C70 230 66 280 72 322 L94 324 C94 290 98 250 106 222 Z" fill="url(#agent-polo)" />
            <circle cx="83" cy="330" r="13" fill="url(#agent-peau)" />

        {/* Buste : polo X Detailing */}
        <path d="M100 176 C120 166 136 162 150 162 C164 162 180 166 200 176 C214 184 220 200 220 220 L212 340 L88340 L80 220 C80 200 86 184 100 176 Z" fill="url(#agent-polo)" />
        <path d="M100 176 C120 166 136 162 150 162 C164 162 180 166 200 176 C214 184 220 200 220 220 L212 340" fill="none" stroke="url(#agent-contre-jour)" strokeWidth="3" />
        <path d="M132 166 L150 196 L168 166" fill="none" stroke="#9b5cf6" strokeWidth="3" strokeLinejoin="round"/>
        <path d="M150 196 L150 232" stroke="#000" strokeOpacity="0.5" strokeWidth="2" />
        <path d="M88 334 L212 334" stroke="#9b5cf6" strokeOpacity="0.6" strokeWidth="2" />
        {/* Logo brodé sur la poitrine (calques officiels) */}
        <image href="/marque/x-640.webp" x="168" y="204" width="34" height="34" />

        {/* Cou et tête */}
        <path d="M138 140 L162 140 L164 168 L136 168 Z" fill="url(#agent-peau)" />
        <ellipse cx="150" cy="112" rx="32" ry="38" fill="url(#agent-peau)" />
        <path d="M118 104 C116 76 134 66 152 66 C172 66 186 80 183 104 C176 92 160 86 146 88 C134 90 124 96 118 104 Z" fill="#1a1512" />
        <path d="M140 128 C146 134 156 134 162 128" fill="none" stroke="#5d4031" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="139" cy="110" r="2.6" fill="#2a1d16" />
            <circle cx="162" cy="110" r="2.6" fill="#2a1d16" />

            {/* Bras droit qui salue */}
            <g className="agent-bras">
              <path d="M204 186 C226 178 238 150 240 112 L218 108 C216 138 206 158 192 170 Z" fill="url(#agent-polo)"/>
          <path d="M230 112 C222 102 222 86 228 78 L234 80 L232 70 C232 64 240 64 241 70 L243 82 L246 66 C247 60255 61 254 67 L251 84 L256 72 C258 67 265 69 263 75 L256 96 C254 108 246 116 238 116 Z" fill="url(#agent-peau)" />
        </g>
      </svg>
    </div>
  );
}

