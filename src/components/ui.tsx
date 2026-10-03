import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * Composants de base X Detailing.
 *
 * Trois règles tirées de la direction artistique :
 *
 * §3.2 — avant d'ajouter une surface, vérifier qu'un changement de typographie ou
 *        d'espacement ne suffirait pas. La plupart des blocs n'ont pas besoin d'être
 *        des cartes.
 * §4   — les séparations sont ton sur ton (`hairline`), pas des bordures visibles.
 * §26  — les métriques se regroupent par la typographie et l'espace, jamais en rangée
 *        de cartes identiques.
 */

// ═══════════════════════════════════════════════════════════════════════════
// SURFACES
// ═══════════════════════════════════════════════════════════════════════════

type PanelMaterial = "polished" | "graphite" | "smoked" | "bare";

const MATERIAL: Record<PanelMaterial, string> = {
  polished: "m-polished",
  graphite: "m-graphite",
  smoked: "m-smoked",
  // Pas de matériau : le contenu se pose directement sur le fond. À préférer
  // chaque fois qu'une séparation visuelle n'apporte rien.
  bare: "",
};

export function Panel({
  title,
  action,
  children,
  material = "polished",
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  material?: PanelMaterial;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[--radius-xd-lg] ${MATERIAL[material]} ${className}`}>
      {(title || action) && (
        <header className="hairline-b flex items-center justify-between gap-4 px-5 py-4">
          <h2 className="text-h3 text-xd-text">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Conservé pour les écrans non encore repris. `Panel` le remplace. */
export const Card = Panel;

export function Footnote({ children }: { children: ReactNode }) {
  return (
    <p className="hairline-t px-5 py-3 text-meta text-xd-text-3">{children}</p>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EN-TÊTE D'ÉCRAN (§3.1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Titre d'écran.
 *
 * Dix-sept écrans portaient leur titre en `text-xl`, deux en `text-h1` : à taille
 * presque égale à celle du contenu, un titre ne situe plus rien. Le §3.1 demande
 * qu'on sache où l'on est en deux secondes — ce qui se joue au premier niveau
 * typographique, pas dans un fil d'Ariane.
 *
 * `lead` dit ce que l'écran permet de faire, jamais ce qu'il affiche : « Clients »
 * suivi de « 8 fiches » n'apprend rien que la liste ne dise déjà.
 */
export function PageHeader({
  title,
  lead,
  actions,
  eyebrow,
  badges,
}: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  /** Statuts qui qualifient le titre : ils se posent à côté, jamais au-dessus. */
  badges?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2 text-xd-text-4">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 text-xd-text">{title}</h1>
          {badges}
        </div>
        {lead && <p className="mt-1.5 max-w-2xl text-body text-xd-text-3">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Contrôle segmenté — période, portée, filtre exclusif.
 *
 * La piste est creusée, le segment actif est une pastille qui remonte : c'est le
 * geste d'un interrupteur physique. Un aplat violet plein, lui, criait plus fort
 * que le chiffre qu'il servait à filtrer (§11, §54).
 */
export function Segmented({
  items,
}: {
  items: Array<{ key: string; label: ReactNode; href: string; active: boolean }>;
}) {
  return (
    <nav className="inline-flex rounded-[--radius-xd-sm] bg-black/30 p-1 [box-shadow:inset_0_1px_2px_0_rgb(0_0_0/0.5)]">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`press rounded-[--radius-xd-xs] px-3.5 py-1.5 text-meta font-medium transition-all duration-150 ${
            item.active
              ? "m-graphite text-xd-text"
              : "text-xd-text-3 hover:text-xd-text-2"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MÉTRIQUES (§26)
// ═══════════════════════════════════════════════════════════════════════════

export type MetricTone = "neutral" | "accent" | "ok" | "warn" | "danger";

const METRIC_TONE: Record<MetricTone, string> = {
  neutral: "text-xd-text",
  accent: "text-xd-purple-bright",
  ok: "text-xd-ok",
  warn: "text-xd-warn",
  danger: "text-xd-danger",
};

export type MetricProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: MetricTone;
};

/**
 * Rangée de métriques : **une seule surface**, des groupes séparés ton sur ton.
 *
 * La première métrique porte le chiffre qui compte et reçoit une taille supérieure ;
 * les suivantes l'accompagnent. Quatre cartes de taille identique ne disent pas au
 * lecteur ce qu'il doit regarder en premier.
 */
export function MetricBar({ metrics }: { metrics: MetricProps[] }) {
  if (metrics.length === 0) return null;
  const [lead, ...rest] = metrics;

  return (
    <section className="m-graphite overflow-hidden rounded-[--radius-xd-lg]">
      <div className="flex flex-col lg:flex-row">
        <div className="px-6 py-5 lg:min-w-64">
          <p className="eyebrow text-xd-text-3">{lead.label}</p>
          <p className={`tabular rise mt-1.5 text-[2.75rem] font-semibold leading-none tracking-[-0.035em] ${METRIC_TONE[lead.tone ?? "neutral"]}`}>
            {lead.value}
          </p>
          {lead.hint && <p className="mt-2 text-meta text-xd-text-3">{lead.hint}</p>}
        </div>

        {rest.length > 0 && (
          // Le nombre de colonnes suit le nombre de métriques : une grille fixe
          // laisse une case vide dès que le compte ne tombe pas juste.
          <div
            className="grid flex-1"
            style={{ gridTemplateColumns: `repeat(${Math.min(rest.length, 3)}, minmax(0, 1fr))` } as CSSProperties}
          >
            {rest.map((metric) => (
              <div
                key={metric.label}
                className="hairline-t px-6 py-5 lg:[grid-column:span_1] lg:[box-shadow:inset_1px_0_0_0_var(--xd-hairline)]"
              >
                <p className="eyebrow text-xd-text-3">{metric.label}</p>
                <p className={`tabular mt-1.5 text-2xl font-semibold leading-none tracking-[-0.025em] ${METRIC_TONE[metric.tone ?? "neutral"]}`}>
                  {metric.value}
                </p>
                {metric.hint && <p className="mt-1.5 text-meta text-xd-text-3">{metric.hint}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Métrique isolée, hors rangée. */
export function Metric({ label, value, hint, tone = "neutral" }: MetricProps) {
  return (
    <div>
      <p className="eyebrow text-xd-text-3">{label}</p>
      <p className={`tabular mt-1.5 text-2xl font-semibold leading-none tracking-[-0.025em] ${METRIC_TONE[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-meta text-xd-text-3">{hint}</p>}
    </div>
  );
}

/** Alias de transition pour les écrans non encore repris. */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const mapped: MetricTone =
    tone === "positive" ? "ok" : tone === "warning" ? "warn" : "neutral";
  return (
    // Aucune surface propre : la tuile est une case de `StatRow`, pas une carte.
    // Quatre cartes identiques côte à côte ne disent pas quoi regarder en premier.
    <div className="px-5 py-4 [box-shadow:inset_1px_0_0_0_var(--xd-hairline),inset_0_1px_0_0_var(--xd-hairline)]">
      <Metric label={label} value={value} hint={hint} tone={mapped} />
    </div>
  );
}

/**
 * Rangée de tuiles : une seule surface, des cases séparées ton sur ton.
 *
 * Les filets intérieurs viennent des tuiles elles-mêmes ; `overflow-hidden` coupe
 * ceux qui tomberaient sur le bord extérieur, si bien que la rangée se relit comme
 * un seul objet quel que soit le nombre de colonnes ou de retours à la ligne.
 */
export function StatRow({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 3 | 4;
}) {
  return (
    <section
      className={`m-graphite grid overflow-hidden rounded-[--radius-xd-lg] sm:grid-cols-2 ${
        columns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"
      }`}
    >
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUTS (§39) — saturation faible, fond subtil
// ═══════════════════════════════════════════════════════════════════════════

const TONES = {
  neutral: "bg-white/[0.06] text-xd-text-2",
  accent: "bg-xd-purple/15 text-xd-purple-bright",
  ok: "bg-xd-ok/12 text-xd-ok",
  warn: "bg-xd-warn/12 text-xd-warn",
  danger: "bg-xd-danger/12 text-xd-danger",
  info: "bg-xd-info/12 text-xd-info",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[--radius-xd-xs] px-2 py-[3px] text-meta font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Statut avec pastille : la couleur porte l'information, le texte la confirme. */
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const dot = {
    neutral: "bg-xd-text-3",
    accent: "bg-xd-purple-bright",
    ok: "bg-xd-ok",
    warn: "bg-xd-warn",
    danger: "bg-xd-danger",
    info: "bg-xd-info",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[--radius-xd-xs] px-2 py-[3px] text-meta font-medium ${TONES[tone]}`}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  );
}

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  PENDING_ASSIGNMENT: { label: "À affecter", tone: "warn" },
  ASSIGNED: { label: "Affecté", tone: "accent" },
  CONFIRMED: { label: "Confirmé", tone: "accent" },
  EN_ROUTE: { label: "En route", tone: "info" },
  ARRIVED: { label: "Arrivé", tone: "info" },
  PHOTOS_BEFORE: { label: "Photos avant", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  PHOTOS_AFTER: { label: "Photos après", tone: "info" },
  PAYMENT: { label: "À encaisser", tone: "warn" },
  COMPLETED: { label: "Terminé", tone: "ok" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
  NO_SHOW: { label: "Client absent", tone: "danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = APPOINTMENT_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <StatusPill tone={entry.tone}>{entry.label}</StatusPill>;
}

/** Indicateur de remplissage du §5. */
export function LoadDot({ level }: { level: "LOW" | "MEDIUM" | "HIGH" }) {
  const map = {
    LOW: { color: "bg-xd-ok", label: "Peu chargé" },
    MEDIUM: { color: "bg-xd-warn", label: "Bien rempli" },
    HIGH: { color: "bg-xd-danger", label: "Journée pleine" },
  };
  return (
    <span className="inline-flex items-center" title={map[level].label}>
      <span className={`size-1.5 rounded-full ${map[level].color}`} aria-hidden />
      <span className="sr-only">{map[level].label}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TABLEAUX (§38) — lignes fines, en-têtes discrets, survol léger
// ═══════════════════════════════════════════════════════════════════════════

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`eyebrow px-5 py-3 text-left font-medium text-xd-text-4 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 align-middle text-body text-xd-text-2 ${className}`}>{children}</td>;
}

/** Ligne de tableau : survol léger, séparation ton sur ton, jamais de zébrure. */
export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <tr
      className={`hairline-t transition-colors duration-150 hover:bg-white/[0.025] ${className}`}
    >
      {children}
    </tr>
  );
}

export function Table({ children, minWidth = 860 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉTATS
// ═══════════════════════════════════════════════════════════════════════════

/** §46 — pas d'illustration, une phrase courte et un éventuel recours. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-body text-xd-text-3">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** §47 — balayage plutôt que spinner. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <span className={`shimmer block rounded-[--radius-xd-xs] ${className}`} aria-hidden />;
}
