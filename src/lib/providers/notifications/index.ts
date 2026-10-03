/**
 * Abstraction notifications (§27, §32).
 *
 * L'implémentation par défaut journalise en base (table `Notification`) au lieu
 * d'envoyer : le contenu et le déclenchement de chaque message sont donc vérifiables
 * avant qu'un seul SMS ne soit facturé.
 */

export type NotificationChannel = "SMS" | "EMAIL" | "PUSH";

export type NotificationRequest = {
  channel: NotificationChannel;
  recipient: string;
  template: string;
  payload?: Record<string, unknown>;
};

export type NotificationResult = {
  providerRef: string | null;
  sent: boolean;
  error?: string;
};

export interface NotificationProvider {
  readonly name: string;
  send(request: NotificationRequest): Promise<NotificationResult>;
}

class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";

  async send(request: NotificationRequest): Promise<NotificationResult> {
    console.info(
      `[notification:${request.channel}] → ${request.recipient} · ${request.template}`,
      request.payload ?? {},
    );
    return { providerRef: null, sent: true };
  }
}

let cached: NotificationProvider | null = null;

export function notificationProvider(): NotificationProvider {
  if (!cached) cached = new ConsoleNotificationProvider();
  return cached;
}
