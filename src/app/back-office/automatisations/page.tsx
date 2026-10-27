import { db } from "@/lib/db";
import { smsReelsActives } from "@/lib/sms";
import { paiementEnLigneActif } from "@/lib/paiement";
import { EnTete, Panneau, Section } from "@/components/backoffice/ui";

export const dynamic = "force-dynamic";

// Automatisations actuellement actives dans le code (règles fixes). Le
// moteur configurable (déclencheur, conditions, actions, historique,
// reprise) arrive à la phase 8.
function ilYaTrenteJours() {
  return new Date(Date.now() - 30 * 86400000);
}

export default async function AutomatisationsPage() {
  const depuis = ilYaTrenteJours();
  const parMotif = await db.sms.groupBy({ by: ["motif"], where: { createdAt: { gte: depuis } }, _count: true });
  const nb = (motif: string) => parMotif.find((m) => m.motif === motif)?._count ?? 0;
  const sms = smsReelsActives();

  const regles = [
    {
      nom: "Confirmation de réservation",
      declencheur: "Réservation enregistrée (site sans paiement en ligne, téléphone) ou acompte validé par Stripe",
      action: "SMS de confirmation au client, une seule fois",
      actif: true,
      envois: nb("CONFIRMATION_RDV"),
    },
    {
      nom: "Affectation d'un opérateur",
      declencheur: "Opérateur affecté à une réservation",
      action: "SMS de mission à l'opérateur et prénom de l'opérateur au client",
      actif: true,
      envois: nb("AFFECTATION_OPERATEUR"),
    },
    {
      nom: "Rappel de la veille",
      declencheur: "Chaque jour à 16 h UTC (17 h ou 18 h à Paris)",
      action: "SMS de rappel aux clients du lendemain, un seul par réservation",
      actif: Boolean(process.env.CRON_SECRET),
      inactif: "CRON_SECRET non configuré",
      envois: nb("RAPPEL_VEILLE"),
    },
    {
      nom: "Libération des créneaux non payés",
      declencheur: "Paiement de l'acompte non finalisé en 30 minutes",
      action: "Réservation annulée, créneau remis en vente",
      actif: paiementEnLigneActif(),
      inactif: "Stripe non configuré",
      envois: null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EnTete titre="Automatisations" sousTitre="Règles automatiques en service et messages envoyés ces 30 derniers jours." />
      <Panneau className="text-sm">
        SMS : {sms ? <span className="text-[var(--success)]">envoi réel par Twilio</span> : <span className="text-[var(--warning)]">simulés (Twilio non configuré), consignés dans le journal</span>}.{" "}
        <a href="/back-office/sms" className="text-[var(--accent-clair)] hover:underline">
          Voir le journal des SMS →
        </a>
      </Panneau>
      <div className="grid gap-3 md:grid-cols-2">
        {regles.map((r) => (
          <Panneau key={r.nom}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{r.nom}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${r.actif ?"bg-[var(--success)]/15 text-[var(--success)]" : "bg-white/5 text-[var(--muted)]"}`}>
                {r.actif ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">Quand : {r.declencheur}</p>
            <p className="text-sm text-[var(--muted)]">Action : {r.action}</p>
            {!r.actif && r.inactif && <p className="mt-2 text-xs text-[var(--warning)]">{r.inactif}</p>}
            {r.envois != null && <p className="mt-2 text-xs text-[var(--muted)]">{r.envois} SMS sur 30 jours</p>}
          </Panneau>
        ))}
      </div>
      <Section titre="À venir (phase 8)">
        <Panneau className="text-sm text-[var(--muted)]">
          Moteur de règles sans code : déclencheur, conditions et actions configurables, rappel du jour J, relances de devis,
          message de satisfaction et avis Google avec consentement, historique d&apos;exécution, test d&apos;unerègle et
          reprise en cas d&apos;erreur.
        </Panneau>
      </Section>
    </div>
  );
}

