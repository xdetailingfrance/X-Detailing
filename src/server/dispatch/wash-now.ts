import { findAvailableSlots } from "../assignment/availability";
import { startOfLocalDay, zonedParts } from "../time";

/**
 * « Laver maintenant » (§7).
 *
 * « Afficher les opérateurs réellement disponibles à proximité, calculer le temps de
 * trajet, proposer le premier opérateur capable d'arriver dans une fenêtre réaliste. »
 *
 * Réutilise le moteur de créneaux plutôt que de refaire un calcul de disponibilité en
 * parallèle : deux implémentations des mêmes contraintes finiraient par diverger, et
 * c'est exactement le genre d'écart qui fait promettre au client un créneau intenable.
 */

/** Délai minimal avant une intervention : l'opérateur doit pouvoir répondre et partir. */
const MIN_LEAD_MIN = 45;

/** Au-delà, ce n'est plus « maintenant ». */
const MAX_WAIT_HOURS = 4;

export type ImmediateSlot = {
  start: string;
  label: string;
  waitMin: number;
  travelMin: number;
  operatorCount: number;
};

export type WashNowResult = {
  available: boolean;
  slots: ImmediateSlot[];
  /** Renseigné quand rien n'est possible : de quoi répondre au client. */
  reason: string | null;
};

export async function findImmediateSlots(input: {
  lat: number;
  lng: number;
  address: string;
  durationMin: number;
  serviceId: string;
  now?: Date;
}): Promise<WashNowResult> {
  const now = input.now ?? new Date();

  const availability = await findAvailableSlots({
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    day: startOfLocalDay(now),
    durationMin: input.durationMin,
    serviceId: input.serviceId,
    leadTimeMin: MIN_LEAD_MIN,
    now,
  });

  if (availability.operatorsConsidered === 0) {
    return { available: false, slots: [], reason: "Aucun opérateur actif sur ce secteur." };
  }

  const cutoff = now.getTime() + MAX_WAIT_HOURS * 3600_000;

  const slots = availability.slots
    .filter((slot) => new Date(slot.start).getTime() <= cutoff)
    .slice(0, 4)
    .map((slot) => ({
      start: slot.start,
      label: slot.label,
      waitMin: Math.round((new Date(slot.start).getTime() - now.getTime()) / 60_000),
      travelMin: slot.travelMin,
      operatorCount: slot.operatorCount,
    }));

  if (slots.length === 0) {
    // La journée n'est pas forcément finie : distinguer « plus rien aujourd'hui » de
    // « rien dans les prochaines heures » évite une réponse trompeuse.
    const laterToday = availability.slots.length > 0;
    const { minutes } = zonedParts(now);

    return {
      available: false,
      slots: [],
      reason: laterToday
        ? "Plus personne dans les prochaines heures, mais il reste des créneaux plus tard aujourd'hui."
        : minutes > 18 * 60
          ? "Les tournées de la journée sont terminées. Réservez pour demain."
          : "Aucun opérateur ne peut se libérer à cette adresse aujourd'hui.",
    };
  }

  return { available: true, slots, reason: null };
}
