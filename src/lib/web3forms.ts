import { BUSINESS } from "./business";

/**
 * Relais formulaire → boîte de réception, par Web3Forms.
 *
 * Web3Forms écrit au titulaire du compte, jamais à une adresse arbitraire : il couvre
 * ce qui doit parvenir à l'entreprise — une demande de devis, une candidature — et
 * rien d'autre.
 *
 * La clé vient de l'environnement, jamais du code : une clé committée permet à
 * n'importe qui d'inonder la boîte. Absente en production, l'envoi échoue et le
 * visiteur en est informé. Absente en développement, l'envoi est simulé et le
 * message écrit dans la console : on peut dérouler le formulaire sans compte.
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

export function formatNotice(lines: BusinessNotice["lines"]): string {
  return lines
    .filter(([, value]) => value != null && value !== "")
    .map(([label, value]) => `${label} : ${value}`)
    .join("\n");
}

export async function notifyBusiness(notice: BusinessNotice): Promise<BusinessNoticeResult> {
  const key = process.env.WEB3FORMS_ACCESS_KEY;
  const message = formatNotice(notice.lines);

  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[web3forms] WEB3FORMS_ACCESS_KEY absente — envoi simulé.\n` +
          `Objet : ${notice.subject}\n${message}`,
      );
      return { sent: true };
    }
    return { sent: false, reason: "WEB3FORMS_ACCESS_KEY absente" };
  }

  const body: Record<string, unknown> = {
    access_key: key,
    subject: notice.subject,
    from_name: BUSINESS.name,
    message,
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
