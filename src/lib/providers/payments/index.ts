/**
 * Abstraction paiement (§16, §32).
 *
 * Le §38 point 5 — qui encaisse, TVA, reversements — n'est pas tranché. Tant qu'il ne
 * l'est pas, `ManualPaymentProvider` permet d'exploiter le système : les espèces sont
 * réelles et contrôlées, le lien de paiement est une page interne à valider à la main.
 * Le jour où Stripe (ou Stripe Connect) est acté, seule cette interface est implémentée.
 */

export type PaymentLink = {
  url: string;
  providerRef: string;
  expiresAt: Date | null;
};

export type PaymentLinkRequest = {
  appointmentReference: string;
  amountCents: number;
  label: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

export interface PaymentProvider {
  readonly name: string;
  /** true si le paiement est confirmé par webhook et non par un clic opérateur. */
  readonly webhookConfirmed: boolean;

  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLink>;
}

class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";
  readonly webhookConfirmed = false;

  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLink> {
    const ref = `manual_${request.appointmentReference}_${Date.now()}`;
    return {
      url: `/paiement/${request.appointmentReference}?ref=${ref}`,
      providerRef: ref,
      expiresAt: new Date(Date.now() + 48 * 3600_000),
    };
  }
}

let cached: PaymentProvider | null = null;

export function paymentProvider(): PaymentProvider {
  if (!cached) cached = new ManualPaymentProvider();
  return cached;
}
