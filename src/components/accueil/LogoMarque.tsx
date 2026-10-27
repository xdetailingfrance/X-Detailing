import contour from "./contour-x.json";

// Logo officiel X Detailing sur fond transparent : superposition des deux
// calques découpés dans le fichier original (X + « DETAILING »), sans le
// carré noir du PNG. Rendu identique au logo sur fond noir.
// Variante « claire » (sur fond blanc) : le mot DETAILING passe en noir,
// même dessin et même typographie ; le X reste tel quel.
export default function LogoMarque({
  id,
  className,
  variante = "sombre",
}: {
  id?: string;
  className?: string;
  variante?: "sombre" | "claire";
}) {
  const { hauteur, bande } = contour;
  return (
    <span id={id} role="img" aria-label="X Detailing" className={`relative block aspect-square ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- calque du logo, servi tel quel */}
      <img src="/marque/x-640.webp" alt="" className="absolute inset-0 h-full w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element -- calque du logo, servi tel quel */}
      <img
        src="/marque/detailing-640.webp"
        alt=""
        className="logo-detailing absolute inset-x-0 w-full"
        style={{
          top: `${(bande[0] / hauteur) * 100}%`,
          height: `${((bande[1] - bande[0]) / hauteur) * 100}%`,
          filter: variante === "claire" ? "brightness(0)" : undefined,
        }}
      />
    </span>
  );
}

