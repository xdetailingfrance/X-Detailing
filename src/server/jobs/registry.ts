import { FOLLOW_UP_PERCENT, FOLLOW_UP_VALID_DAYS, issueVoucher } from "../vouchers";
import { prisma } from "../db";
import { checkUpcomingWeather } from "../weather";
import { purgeOldPings } from "../tracking";
import { customersDueForFollowUp } from "../crm";
import { notificationProvider } from "@/lib/providers/notifications";
import { FOLLOW_UP_AFTER_DAYS, FOLLOW_UP_TEMPLATE } from "../notification-templates";
import { grantDueRewards } from "../loyalty";

/**
 * Tâches récurrentes (§37 phase 6 — automatisations).
 *
 * Jusqu'ici, météo, purge et relances existaient en scripts : exécutables à la main,
 * donc jamais exécutés. Elles deviennent ici des tâches nommées, avec un intervalle
 * minimal et une trace d'exécution.
 *
 * Le déclenchement reste externe (`/api/cron`) : embarquer un ordonnanceur dans le
 * processus web le rendrait dépendant d'une instance unique, ce qui casserait à la
 * première montée en charge.
 */

export type JobSummary = Record<string, unknown>;

export type JobDefinition = {
  name: string;
  label: string;
  /** Intervalle minimal entre deux exécutions réussies. */
  everyMinutes: number;
  description: string;
  run: () => Promise<JobSummary>;
};

/** Délai laissé au client avant de lui demander un avis : pas dans la minute qui suit. */
const REVIEW_DELAY_HOURS = 2;
const REVIEW_WINDOW_DAYS = 7;

/** Une relance envoyée récemment interdit d'en renvoyer une (§23). */
const FOLLOW_UP_COOLDOWN_DAYS = 30;

/** Nombre de relances envoyées par exécution : une campagne, pas un publipostage. */
const FOLLOW_UP_BATCH = 10;

export const JOBS: JobDefinition[] = [
  {
    name: "meteo",
    label: "Contrôle météo",
    everyMinutes: 12 * 60,
    description:
      "Vérifie les prestations extérieures des 48 prochaines heures et propose une reprogrammation si les conditions les rendent impossibles (§9).",
    run: async () => {
      const results = await checkUpcomingWeather({ horizonHours: 48 });
      return {
        contrôlées: results.length,
        incompatibles: results.filter((r) => r.verdict === "INCOMPATIBLE").length,
        risques: results.filter((r) => r.verdict === "RISK").length,
        reprogrammations: results.filter((r) => r.rescheduleProposed).length,
      };
    },
  },

  {
    name: "purge-gps",
    label: "Purge des traces GPS",
    everyMinutes: 24 * 60,
    description:
      "Supprime les positions au-delà de la durée de conservation. Une politique qui ne s'exécute pas n'en est pas une (§31).",
    run: async () => {
      const { deleted, cutoff } = await purgeOldPings();
      return { supprimées: deleted, antérieuresAu: cutoff.toISOString().slice(0, 10) };
    },
  },

  {
    name: "demande-avis",
    label: "Demandes d'avis",
    everyMinutes: 6 * 60,
    description:
      "Envoie le lien d'avis aux clients dont la prestation est terminée depuis plus de deux heures (§25).",
    run: async () => {
      const now = Date.now();

      const appointments = await prisma.appointment.findMany({
        where: {
          status: "COMPLETED",
          reviewRequestedAt: null,
          review: null,
          finishedAt: {
            lte: new Date(now - REVIEW_DELAY_HOURS * 3600_000),
            gte: new Date(now - REVIEW_WINDOW_DAYS * 24 * 3600_000),
          },
        },
        select: {
          id: true, reference: true, publicToken: true,
          customer: { select: { firstName: true, email: true, phone: true } },
        },
        take: 50,
      });

      for (const appointment of appointments) {
        await notificationProvider().send({
          channel: appointment.customer.email ? "EMAIL" : "SMS",
          recipient: appointment.customer.email ?? appointment.customer.phone,
          template: "demande_avis",
          payload: {
            prenom: appointment.customer.firstName,
            reference: appointment.reference,
            lien: `/avis/${appointment.publicToken}`,
          },
        });

        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reviewRequestedAt: new Date() },
        });
      }

      return { demandes: appointments.length };
    },
  },

  {
    name: "relances",
    label: "Relances clients",
    everyMinutes: 24 * 60,
    description:
      "Un mois après un lavage, propose le suivant avec un bon de -10 % nominatif. " +
      "Consentement et délai anti-spam vérifiés (§23).",
    run: async () => {
      const due = await customersDueForFollowUp(FOLLOW_UP_AFTER_DAYS);

      const recent = await prisma.notification.findMany({
        where: {
          template: FOLLOW_UP_TEMPLATE,
          createdAt: { gte: new Date(Date.now() - FOLLOW_UP_COOLDOWN_DAYS * 24 * 3600_000) },
        },
        select: { recipient: true },
      });
      const contacted = new Set(recent.map((n) => n.recipient));

      const targets = due
        .filter((row) => row.marketingOptIn && !contacted.has(row.email ?? row.phone))
        .slice(0, FOLLOW_UP_BATCH);

      for (const target of targets) {
        const channel = target.email ? "EMAIL" : "SMS";
        const recipient = target.email ?? target.phone;

        // Le bon est créé avant l'envoi : si le message part, le code qu'il annonce
        // existe déjà et le tunnel de réservation l'accepte. L'inverse laisserait un
        // client devant un code refusé.
        const voucher = await issueVoucher({
          customerId: target.customerId,
          percentOff: FOLLOW_UP_PERCENT,
          reason: `Relance ${FOLLOW_UP_AFTER_DAYS} jours après ${target.lastServiceName}`,
          validDays: FOLLOW_UP_VALID_DAYS,
        });

        const payload = {
          prenom: target.name,
          dernierLavage: target.lastVisit.toISOString(),
          dernierePrestation: target.lastServiceName,
          code: voucher.code,
          remise: `${FOLLOW_UP_PERCENT} %`,
          valableJusquau: voucher.expiresAt.toISOString(),
        };

        const result = await notificationProvider().send({
          channel,
          recipient,
          template: FOLLOW_UP_TEMPLATE,
          payload,
        });

        await prisma.notification.create({
          data: {
            channel,
            recipient,
            template: FOLLOW_UP_TEMPLATE,
            payload,
            status: result.sent ? "SENT" : "FAILED",
            sentAt: result.sent ? new Date() : null,
            error: result.error ?? null,
          },
        });
      }

      return { éligibles: due.length, relancés: targets.length, remise: `${FOLLOW_UP_PERCENT} %` };
    },
  },

  {
    name: "offres-expirees",
    label: "Offres de créneau expirées",
    everyMinutes: 60,
    description:
      "Ferme les créneaux remis en jeu que plus personne ne peut accepter à temps (§8).",
    run: async () => {
      const { count } = await prisma.slotOffer.updateMany({
        where: { status: "SENT", expiresAt: { lt: new Date() } },
        data: { status: "EXPIRED" },
      });
      return { expirées: count };
    },
  },

  {
    name: "fidelite",
    label: "Récompenses de fidélité",
    everyMinutes: 24 * 60,
    description:
      "Attribue les récompenses aux clients qui ont atteint le seuil de lavages défini.",
    run: grantDueRewards,
  },
];

export const JOB_NAMES = JOBS.map((job) => job.name);

export function findJob(name: string): JobDefinition | undefined {
  return JOBS.find((job) => job.name === name);
}
