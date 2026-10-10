import { BUSINESS } from "@/lib/business";

/**
 * Prévenir l'entreprise — pas le client.
 *
 * Web3Forms est un relais formulaire → boîte de réception : il écrit au titulaire du
 * compte, jamais à une adresse arbitraire. Il couvre donc ce qui doit *vous* parvenir
 * — une candidature d'opérateur, un lead — et rien d'autre.
 *
 * CE QU'IL NE COUVRE PAS. Les messages destinés aux clients — confirmation de
 * réservation, arrivée imminente, demande d'avis, relance à trente jours avec le bon
 * de remise — ne peuvent pas passer par ici : ils atterriraient tous dans la boîte de
 * l'entreprise. Ils attendent un vrai fournisseur transactionnel, et d'ici là le
 * `NotificationProvider` par défaut se contente de les journaliser.
 *
 * La clé vient de l'environnement, jamais du code : le dépôt est public, et une clé
 * committée permet à n'importe qui d'inonder la boîte. Absente, l'envoi est ignoré —
 * un poste de développement ne doit pas écrire à l'entreprise à chaque essai.
 */

const ENDPOINT = "https://api.web3forms.com/submit";

export type BusinessNotice = {
  /** Objet du message, tel qu'il apparaîtra dans la boîte. */
  subject: string;
  /** Ce qui s'est passé, ligne à ligne. */
  lines: Array<[label: string, value: string | null | undefined]>;
  /** Adresse à laquelle répondre directement, quand il y en a une. */
  replyTo?: string | null;
};

export type BusinessNoticeResult = { sent: boolean; reason?: string };

export async function notifyBusiness(notice: BusinessNotice): Promise<BusinessNoticeResult> {
  const key = process.env.WEB3FORMS_ACCESS_KEY;
  if (!key) return { sent: false, reason: "WEB3FORMS_ACCESS_KEY absente" };

  const body: Record<string, unknown> = {
    access_key: key,
    subject: notice.subject,
    from_name: BUSINESS.name,
    message: notice.lines
      .filter(([, value]) => value != null && value !== "")
      .map(([label, value]) => `${label} : ${value}`)
      .join("\n"),
  };

  if (notice.replyTo) body.replyto = notice.replyTo;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { sent: false, reason: `HTTP ${res.status}` };

    const payload = (await res.json()) as { success?: boolean; message?: string };
    return payload.success
      ? { sent: true }
      : { sent: false, reason: payload.message ?? "refus du relais" };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "échec réseau" };
  }
}
