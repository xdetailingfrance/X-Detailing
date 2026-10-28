import { db } from "@/lib/db";
import { formatParis } from "@/lib/heure";
import { fournisseurSms, smsReelsActives } from "@/lib/sms";

export const dynamic = "force-dynamic";

const LIBELLE_MOTIF: Record<string, string> = {
  CONFIRMATION_RDV: "Confirmation RDV",
  AFFECTATION_OPERATEUR: "Affectation",
  MODIFICATION_RDV: "RDV déplacé",
  ANNULATION_RDV: "Annulation",
  RAPPEL_VEILLE: "Rappel veille",
  MANUEL: "Message",
};

const STYLE_STATUT: Record<string, string> = {
  ENVOYE: "text-[var(--success)]",
  SIMULE: "text-[var(--warning)]",
  ECHEC: "text-[var(--danger)]",
};

// Journal des SMS : automatiques (confirmation, affectation, rappels) et
// envoyés par Lola ou l'équipe.
export default async function SmsPage() {
  const sms = await db.sms.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const reels = smsReelsActives();
  const fournisseur = fournisseurSms();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">SMS</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          {reels
            ? `Envoi réel via ${fournisseur === "brevo" ? "Brevo" : "Twilio"}.`
            : "Mode simulé : aucun fournisseur SMS n'est configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM) — les messages sont consignés ici sans être envoyés."}
        </p>
      </div>
      <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[var(--surface)] text-[var(--muted)] text-left">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Destinataire</th>
              <th className="px-4 py-2">Message</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {sms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)]">
                  Aucun SMS envoyé pour le moment.
                </td>
              </tr>
            )}
            {sms.map((s) => (
              <tr key={s.id} className="border-t border-[var(--border)] align-top">
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatParis(s.createdAt, { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-2">
                  {s.destinataire}
                  <span className="block text-xs text-[var(--muted)]">{s.telephone}</span>
                </td>
                <td className="px-4 py-2 max-w-md">
                  {s.message}
                  <span className="block text-xs text-[var(--muted)]">par {s.envoyePar}</span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{LIBELLE_MOTIF[s.motif] ?? s.motif}</td>
                <td className={`px-4 py-2 whitespace-nowrap ${STYLE_STATUT[s.statut]}`}>
                  {s.statut === "ENVOYE" ? "Envoyé" : s.statut === "SIMULE" ? "Simulé" : `Échec : ${s.erreur}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
}

