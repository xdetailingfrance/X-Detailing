import { db } from "@/lib/db";
import { emailsReelsActifs } from "@/lib/email";
import { fournisseurSms } from "@/lib/sms";
import { LIBELLE_ROLE } from "@/lib/permissions";
import { formatParis } from "@/lib/heure";
import { EnTete, Panneau, Section } from "@/components/backoffice/ui";

export const dynamic = "force-dynamic";

// Paramètres : catalogue, comptes, journal d'audit et état des
// intégrations (configurées ou non, sans jamais afficher de secret).
export default async function ParametresPage() {
  const utilisateurs = await db.utilisateur.findMany({
    select: { id: true, email: true, role: true, actif: true, createdAt: true, operateur: { select: { prenom: true, nom: true } } },
    orderBy: [{ actif: "desc" }, { role: "asc" }, { email: "asc" }],
  });

  const integrations = [
    { nom: "Base de données", ok: Boolean(process.env.DATABASE_URL), detail: "PostgreSQL" },
    { nom: "Connexion sécurisée", ok: process.env.DISABLE_AUTH === "false" && Boolean(process.env.SESSION_SECRET), detail: "DISABLE_AUTH=false et SESSION_SECRET" },
    { nom: "Paiement Stripe", ok: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), detail: "Clé secrète et webhook" },
    { nom: "SMS", ok: fournisseurSms() !== null, detail: fournisseurSms() === "brevo" ? "Brevo" : fournisseurSms() === "twilio" ? "Twilio" : "BREVO_API_KEY ou TWILIO_*" },
    { nom: "Rappels automatiques", ok: Boolean(process.env.CRON_SECRET), detail: "CRON_SECRET" },
    { nom: "Lola (Claude)", ok: Boolean(process.env.ANTHROPIC_API_KEY), detail: "ANTHROPIC_API_KEY" },
    { nom: "Meta Ads", ok: false, detail: "Phase 4" },
    { nom: "Cartographie et GPS", ok: false, detail: "Phase 6" },
    { nom: "E-mail (devis, factures, confirmations)", ok: emailsReelsActifs(), detail: "BREVO_API_KEY + BREVO_EMAIL_SENDER" },
    { nom: "Stockage photos et justificatifs", ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN), detail: "BLOB_READ_WRITE_TOKEN" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <EnTete titre="Paramètres" />
      <div className="grid gap-3 md:grid-cols-2">
        <a href="/back-office/packs" className="bo-panneau rounded-2xl p-5 transition hover:border-[var(--accent)]/60">
          <p className="font-medium">Prestations, tarifs et options</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Grille de prix par catégorie de véhicule, options et durées.</p>
        </a>
        <a href="/back-office/journal" className="bo-panneau rounded-2xl p-5 transition hover:border-[var(--accent)]/60">
             <p className="font-medium">Journal d&apos;audit</p>
             <p className="mt-1 text-sm text-[var(--muted)]">Connexions, paiements, tarifs, affectations, annulations.</p>
          </a>
        </div>

      <Section titre="Intégrations">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((i) => (
            <Panneau key={i.nom} className="flex items-center justify-between gap-3 !p-4">
              <div>
                <p className="text-sm font-medium">{i.nom}</p>
                <p className="text-xs text-[var(--muted)]">{i.detail}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${i.ok ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-white/5 text-[var(--muted)]"}`}>
                {i.ok ? "Configurée" : "Non configurée"}
              </span>
            </Panneau>
          ))}
        </div>
      </Section>

      <Section titre="Comptes" aide="Création : npm run creer-utilisateur (gestion depuis cet écran à venir)">
        <div className="bo-panneau overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Fiche opérateur</th>
                <th className="px-4 py-3 font-medium">Créé le</th>
                <th className="px-4 py-3 font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2.5">{u.email}</td>
                  <td className="px-4 py-2.5">{LIBELLE_ROLE[u.role]}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{u.operateur ? `${u.operateur.prenom} ${u.operateur.nom}` : "—"}</td>
                  <td className="px-4 py-2.5 text-[var(--muted)]">{formatParis(u.createdAt, { dateStyle: "short"})}</td>
                  <td className="px-4 py-2.5">{u.actif ? "Actif" : "Désactivé"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

