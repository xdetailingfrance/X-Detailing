import { listerRendezVousAvecRelations } from "@/lib/queries";
import { formatParis } from "@/lib/heure";
import { EnTete, Panneau } from "@/components/backoffice/ui";

export const dynamic = "force-dynamic";

const EN_COURS = ["EN_ROUTE", "ARRIVE", "CONTROLE", "PHOTOS_AVANT", "LAVAGE", "PHOTOS_APRES", "PAIEMENT", "EN_COURS"] as const;

// Dossiers d'intervention : ce qui est fait et ce qui manque (signatures,
// photos, paiement) pour chaque prestation en cours ou récemment clôturée.
export default async function InterventionsPage() {
  const dossiers = (
    await listerRendezVousAvecRelations({ statut: { in: [...EN_COURS, "TERMINE"] } })
  ).reverse().slice(0, 100);

  return (
    <div className="flex flex-col gap-6">
      <EnTete titre="Interventions" sousTitre="Dossier de chaque prestation : signatures, photos avant/après et paiement." />
      <Panneau className="text-sm text-[var(--muted)]">
        Contrôle actuel : 4 photos avant, 4 photos après et deux signatures, cochées par l&apos;opérateur. Les 8+ 8 photos
        réelles stockées avec la date, la galerie avant/après et la procédure exceptionnelle du directeur arrivent à la
        phase 5.
      </Panneau>
      <div className="bo-panneau overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Prestation</th>
              <th className="px-4 py-3 font-medium">Opérateur</th>
              <th className="px-4 py-3 font-medium">Signature début</th>
              <th className="px-4 py-3 font-medium">Photos avant</th>
              <th className="px-4 py-3 font-medium">Photos après</th>
              <th className="px-4 py-3 font-medium">Signature fin</th>
              <th className="px-4 py-3 font-medium">Paiement</th>
            </tr>
          </thead>
          <tbody>
            {dossiers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  Aucune intervention en cours ou terminée.
                </td>
              </tr>
            )}
            {dossiers.map((r) => {
              const avant = r.photosAvant.filter((p) => p.prise).length;
              const apres = r.photosApres.filter((p) => p.prise).length;
              return (
                <tr key={r.id} className="border-t border-[var(--border)] hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <a href={`/back-office/rendez-vous/${r.id}`} className="font-medium hover:text-[var(--accent-clair)]">
                      {r.client.prenom} {r.client.nom}
                    </a>
                    <p className="text-xs text-[var(--muted)]">{formatParis(r.dateHeure, { dateStyle: "short", timeStyle: "short" })}</p>
                  </td>
                  <td className="px-4 py-2.5">{r.operateur ? `${r.operateur.prenom} ${r.operateur.nom}` : "—"}</td>
                  <td className="px-4 py-2.5"><Coche ok={!!r.signatureControleAt} /></td>
                  <td className="px-4 py-2.5"><Compte n={avant} sur={r.photosAvant.length} /></td>
                  <td className="px-4 py-2.5"><Compte n={apres} sur={r.photosApres.length} /></td>
                  <td className="px-4 py-2.5"><Coche ok={!!r.signatureFinAt} /></td>
                  <td className="px-4 py-2.5">
                    {r.paiementConfirmeAt ? (
                      <span>
                        {r.modePaiement === "ESPECES" ? "Espèces" : "Carte"} · déclaré
                        {r.numeroFacture && <span className="block text-xs text-[var(--muted)]">{r.numeroFacture}</span>}
                      </span>
                    ) : (
                      <span className="text-[var(--muted)]">En attente</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Coche({ ok }: { ok: boolean }) {
  return ok ? <span className="text-[var(--success)]">✓ Fait</span> : <span className="text-[var(--muted)]">✗ Manquant</span>;
}

function Compte({ n, sur }: { n: number; sur: number }) {
  return <span className={n === sur ? "text-[var(--success)]" : "text-[var(--muted)]"}>{n} / {sur}</span>;
}

