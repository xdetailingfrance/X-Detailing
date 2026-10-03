/**
 * Rendu d'un paraphe (§32).
 *
 * Le tracé est stocké en chemins SVG plutôt qu'en image : quelques kilo-octets, net à
 * toute taille, et relisible sans dépendre d'un décodeur d'image. Le repère est fixe —
 * 1000 × 300 — donc le même paraphe s'affiche identique sur le téléphone de l'opérateur
 * et dans le dossier au central.
 *
 * Fond clair assumé : une signature se lit à l'encre sombre sur blanc, comme sur le
 * papier qu'elle remplace.
 */
export function SignatureView({
  paths,
  className = "",
}: {
  paths: string;
  className?: string;
}) {
  let drawn: string[] = [];
  try {
    const parsed: unknown = JSON.parse(paths);
    if (Array.isArray(parsed)) drawn = parsed.filter((d): d is string => typeof d === "string");
  } catch {
    // Tracé illisible : on n'affiche rien plutôt qu'un cadre vide trompeur.
    return null;
  }

  if (drawn.length === 0) return null;

  return (
    <svg
      viewBox="0 0 1000 300"
      role="img"
      aria-label="Signature du client"
      className={`w-full rounded-[--radius-xd-sm] bg-white ${className}`}
    >
      {drawn.map((d, index) => (
        <path
          key={index}
          d={d}
          fill="none"
          stroke="#16161b"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
