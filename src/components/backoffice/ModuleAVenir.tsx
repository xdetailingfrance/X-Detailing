import { EnTete, Panneau } from "@/components/backoffice/ui";

// Rubrique pas encore construite : on dit ce qu'elle fera, quand, et ce
// qu'il faudra configurer — jamais de données fictives.
export default function ModuleAVenir({
  titre,
  phase,
  fonctions,
  aConfigurer,
  enAttendant,
}: {
  titre: string;
  phase: string;
  fonctions: string[];
  aConfigurer?: string[];
  enAttendant?: { libelle: string; href: string }[];
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <EnTete titre={titre} sousTitre={`Module en construction — ${phase} du plan de développement.`} />
      <Panneau>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Ce que fera ce module</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {fonctions.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              {f}
            </li>
          ))}
        </ul>
      </Panneau>
      {aConfigurer && aConfigurer.length > 0 && (
        <Panneau>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">À fournir pour l&apos;activer</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-[var(--muted)]">
            {aConfigurer.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </Panneau>
      )}
      {enAttendant && (
        <div className="flex flex-wrap gap-2 text-sm">
          {enAttendant.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg border border-[var(--border)] px-3 py-2 hover:border-[var(--accent)]">
              {l.libelle} →
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

