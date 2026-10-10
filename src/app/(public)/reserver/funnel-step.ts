import type { FunnelVehicleClass } from "./vehicles";

/**
 * À quelle étape ouvrir le tunnel.
 *
 * Module neutre — pas de `"use client"` : une fonction exportée depuis un module
 * client arriverait au serveur sous forme de référence, et elle doit rester testable
 * sans monter de composant.
 */

export const STEP_VEHICLE = 0;
export const STEP_SERVICE = 1;
export const STEP_ADDRESS = 2;

export type FunnelPreset = {
  vehicleClass?: FunnelVehicleClass | null;
  serviceId?: string | null;
};

/**
 * La première question encore sans réponse, dans l'ordre.
 *
 * Le piège est de sauter en avant sur la seule présence d'une réponse tardive : une
 * carte de pack transmet la prestation sans la catégorie du véhicule, et ouvrir
 * directement à l'adresse laissait cette catégorie vide jusqu'à la validation
 * serveur, sur « Invalid option ». Une étape ne se saute que si elle a sa réponse.
 */
export function initialStep(preset: FunnelPreset | null | undefined): number {
  if (!preset?.vehicleClass) return STEP_VEHICLE;
  if (!preset.serviceId) return STEP_SERVICE;
  return STEP_ADDRESS;
}
