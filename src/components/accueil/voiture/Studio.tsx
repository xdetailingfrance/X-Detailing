import type { ReactNode } from "react";

// Décor de studio sombre (sol laqué, rampes violettes) avec, en option, le
// décor « domicile » qui apparaît pendant la réservation.
export default function Studio({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`studio ${className}`} aria-hidden="true">
      <div className="decor-domicile">
        <svg viewBox="0 0 1100 300" fill="none" stroke="rgba(18,13,26,0.28)" strokeWidth="1.5">
          {/* Maison, garage, allée : simple tracé, éclairage chaud aux fenêtres */}
          <path d="M120 300 L120 150 L330 40 L540 150 L540 300" />
          <path d="M540 300 L540 170 L860 170 L860 300" />
          <path d="M590 300 L590 205 L810 205 L810 300" />
          <path d="M590 230 L810 230 M590 255 L810 255 M590 280 L810 280" strokeOpacity="0.5" />
          <rect x="180" y="185" width="90" height="70" fill="rgba(255,196,120,0.28)" />
          <rect x="390" y="185" width="90" height="70" fill="rgba(255,196,120,0.22)" />
          <path d="M300 300 L300 215 L360 215 L360 300" />
          <path d="M40 300 L1060 300" strokeOpacity="0.35" />
          <path d="M930 300 C930 220 900 170 960 120 C1010 170 990 220 990 300" strokeOpacity="0.4" />
        </svg>
      </div>
      <div className="studio-sol" />
      {children}
    </div>
  );
}

