import type { ReactNode } from "react";

// Briques visuelles du back-office (thème sombre, accents violets).

export function EnTete({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-[var(--muted)]">{sousTitre}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Section({ titre, aide, children }: { titre: string; aide?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{titre}</h2>
        {aide && <p className="text-xs text-[var(--muted)]">{aide}</p>}
      </div>
      {children}
    </section>
  );
}

export function Panneau({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bo-panneau rounded-2xl p-4 md:p-5 ${className}`}>{children}</div>;
}

// Carte statistique. ton = « estimation » ou « indisponible » pour qu'une
// estimation ne soit jamais lue comme un montant définitif.
export function Stat({
  titre,
  valeur,
  detail,
  ton = "normal",
  href,
}: {
  titre: string;
  valeur: string;
  detail?: string;
  ton?: "normal" | "accent" | "estimation" | "indisponible";
  href?: string;
}) {
  const contenu = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">{titre}</p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums md:text-[1.7rem] ${
          ton === "indisponible" ? "text-[var(--muted)] text-lg md:text-lg" : ton === "accent" ? "text-[var(--accent-clair)]" : ""
        }`}
      >
        {valeur}
      </p>
      {detail && <p className="mt-1 text-xs text-[var(--muted)]">{detail}</p>}
      {ton === "estimation" && (
        <span className="mt-2 inline-block rounded-full border border-[var(--warning)]/40 px-2 py-0.5 text-[10px]uppercase tracking-wide text-[var(--warning)]">
          Estimation
        </span>
      )}
      </>
    );
    const classes = `bo-stat rounded-2xl p-4 ${href ? "transition hover:border-[var(--accent)]/60" : ""}`;
    return href ? (
      <a href={href} className={classes}>
        {contenu}
      </a>
    ) : (
      <div className={classes}>{contenu}</div>
    );
}

export const euros = (n: number, decimales = 0) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: decimales, maximumFractionDigits: decimales });

