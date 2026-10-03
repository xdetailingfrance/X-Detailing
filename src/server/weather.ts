import { prisma } from "./db";
import { weatherProvider, type HourlyWeather } from "@/lib/providers/weather";
import { raiseAlert } from "./quality/alerts";
import { notificationProvider } from "@/lib/providers/notifications";
import { formatLocalDateTime } from "./time";

/**
 * Surveillance météo des prestations extérieures (§9).
 *
 * « En cas de conditions incompatibles avec la prestation, proposer une
 * reprogrammation. Le client doit conserver le contrôle final de la nouvelle
 * date/heure. »
 *
 * Le système **propose**, il ne déplace jamais un rendez-vous de lui-même.
 */

export type Verdict = "OK" | "RISK" | "INCOMPATIBLE";

/** Seuils pour un lavage extérieur. Un lavage intérieur se fait à l'abri du véhicule. */
const RAIN_INCOMPATIBLE_MM = 2;
const RAIN_RISK_MM = 0.4;
const COLD_INCOMPATIBLE_C = 0;
const COLD_RISK_C = 3;
const WIND_RISK_KPH = 45;

export type WeatherAssessment = {
  verdict: Verdict;
  reason: string | null;
  precipitationMm: number;
  temperatureC: number;
  windKph: number;
  conditionCode: string | null;
};

/**
 * Juge la fenêtre d'intervention à partir des prévisions horaires qui la recouvrent.
 * On retient le pire moment : une averse à mi-prestation gâche tout le lavage.
 */
export function assess(hours: HourlyWeather[], exterior: boolean): WeatherAssessment | null {
  if (hours.length === 0) return null;

  const precipitationMm = Math.max(...hours.map((h) => h.precipitationMm));
  const temperatureC = Math.min(...hours.map((h) => h.temperatureC));
  const windKph = Math.max(...hours.map((h) => h.windKph));
  const conditionCode = hours[0].conditionCode;

  const base = { precipitationMm, temperatureC, windKph, conditionCode };

  // Un lavage intérieur n'est gêné que par une pluie forte, au chargement du matériel.
  if (!exterior) {
    return precipitationMm >= RAIN_INCOMPATIBLE_MM * 2
      ? { ...base, verdict: "RISK", reason: "pluie forte au moment de l'intervention" }
      : { ...base, verdict: "OK", reason: null };
  }

  if (precipitationMm >= RAIN_INCOMPATIBLE_MM) {
    return { ...base, verdict: "INCOMPATIBLE", reason: `pluie annoncée (${precipitationMm.toFixed(1)} mm)` };
  }
  if (temperatureC <= COLD_INCOMPATIBLE_C) {
    return { ...base, verdict: "INCOMPATIBLE", reason: `gel annoncé (${temperatureC.toFixed(0)} °C)` };
  }
  if (precipitationMm >= RAIN_RISK_MM) {
    return { ...base, verdict: "RISK", reason: `averses possibles (${precipitationMm.toFixed(1)} mm)` };
  }
  if (temperatureC <= COLD_RISK_C) {
    return { ...base, verdict: "RISK", reason: `températures basses (${temperatureC.toFixed(0)} °C)` };
  }
  if (windKph >= WIND_RISK_KPH) {
    return { ...base, verdict: "RISK", reason: `vent fort (${windKph.toFixed(0)} km/h)` };
  }

  return { ...base, verdict: "OK", reason: null };
}

export type WeatherCheckResult = {
  reference: string;
  appointmentId: string;
  verdict: Verdict;
  reason: string | null;
  rescheduleProposed: boolean;
};

/**
 * Contrôle les prestations à venir dans les `horizonHours` prochaines heures.
 * À exécuter en tâche récurrente (`npm run check:meteo`).
 */
export async function checkUpcomingWeather(options: {
  horizonHours?: number;
  now?: Date;
} = {}): Promise<WeatherCheckResult[]> {
  const now = options.now ?? new Date();
  const horizon = new Date(now.getTime() + (options.horizonHours ?? 48) * 3600_000);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledStart: { gte: now, lt: horizon },
      status: { in: ["ASSIGNED", "CONFIRMED"] },
    },
    select: {
      id: true, reference: true, lat: true, lng: true,
      scheduledStart: true, scheduledEnd: true, publicToken: true,
      service: { select: { kind: true, name: true } },
      customer: { select: { firstName: true, email: true, phone: true } },
      weatherChecks: {
        where: { rescheduleProposed: true },
        select: { id: true },
        take: 1,
      },
    },
  });

  const provider = weatherProvider();
  const results: WeatherCheckResult[] = [];

  for (const appointment of appointments) {
    const exterior = appointment.service.kind !== "INTERIOR";

    let hours: HourlyWeather[];
    try {
      hours = await provider.forecast(
        { lat: appointment.lat, lng: appointment.lng },
        appointment.scheduledStart,
        appointment.scheduledEnd,
      );
    } catch {
      // Une prévision indisponible n'est pas une raison de perturber un rendez-vous.
      continue;
    }

    const covering = hours.filter(
      (h) =>
        h.at.getTime() >= appointment.scheduledStart.getTime() - 3600_000 &&
        h.at.getTime() <= appointment.scheduledEnd.getTime(),
    );

    const assessment = assess(covering, exterior);
    if (!assessment) continue;

    const alreadyProposed = appointment.weatherChecks.length > 0;
    const shouldPropose = assessment.verdict === "INCOMPATIBLE" && !alreadyProposed;

    await prisma.weatherCheck.create({
      data: {
        appointmentId: appointment.id,
        conditionCode: assessment.conditionCode,
        precipitationMm: assessment.precipitationMm,
        temperatureC: assessment.temperatureC,
        windKph: assessment.windKph,
        verdict: assessment.verdict,
        rescheduleProposed: shouldPropose,
      },
    });

    if (shouldPropose) {
      await raiseAlert({
        type: "SCHEDULE_CONFLICT",
        severity: "WARNING",
        title: `Météo incompatible — ${appointment.reference}`,
        message:
          `${assessment.reason} le ${formatLocalDateTime(appointment.scheduledStart)}. ` +
          "Une reprogrammation a été proposée au client, qui garde la décision.",
        appointmentId: appointment.id,
      });

      // §9 — on propose, le client tranche. Aucun déplacement automatique.
      await notificationProvider().send({
        channel: appointment.customer.email ? "EMAIL" : "SMS",
        recipient: appointment.customer.email ?? appointment.customer.phone,
        template: "meteo_reprogrammation",
        payload: {
          prenom: appointment.customer.firstName,
          reference: appointment.reference,
          raison: assessment.reason,
          lien: `/reservation/${appointment.publicToken}`,
        },
      });
    }

    results.push({
      reference: appointment.reference,
      appointmentId: appointment.id,
      verdict: assessment.verdict,
      reason: assessment.reason,
      rescheduleProposed: shouldPropose,
    });
  }

  return results;
}
