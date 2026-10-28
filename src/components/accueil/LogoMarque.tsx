// Logo officiel X Detailing, servi tel quel.
//
// Il n'est plus découpé en calques : sur la version définitive, le mot
// DETAILING traverse le X au lieu d'être posé dessous, et les deux ne sont
// plus séparables. Il est aussi dessiné pour un fond sombre — le mot est gris
// anthracite —, donc il garde son fond noir sur les pages claires plutôt que
// d'être détouré, ce qui le rendrait illisible.
//
// Aucune retouche : ni redécoupe, ni changement de forme ou de typographie.
export default function LogoMarque({
  id,
  className,
  priorite,
}: {
  id?: string;
  className?: string;
  priorite?: boolean;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- logo servi tel quel, sans optimisation */
    <img
      id={id}
      src="/marque/logo-320.webp"
      srcSet="/marque/logo-320.webp 320w, /marque/logo-640.webp 640w, /marque/logo-1254.webp 1254w"
      sizes="(max-width: 640px) 64px, 96px"
      alt="X Detailing"
      loading={priorite ? "eager" : "lazy"}
      className={`block aspect-square rounded-[14px] object-contain ${className ?? ""}`}
    />
  );
}
