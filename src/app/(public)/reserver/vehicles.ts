/**
 * Classes de véhicule proposées au client.
 *
 * Module neutre — pas de `"use client"` : la page serveur valide le paramètre d'URL
 * avec cette liste, et un tableau exporté depuis un module client lui arriverait sous
 * forme de référence, pas de valeur.
 */

export const VEHICLES = [
  ["CITADINE", "Citadine", "Clio, 208, Polo…"],
  ["BERLINE", "Berline", "Série 3, A4, Mégane…"],
  ["BREAK", "Break", "Passat SW, V60…"],
  ["SUV", "SUV", "3008, Tiguan, Qashqai…"],
  ["QUATRE_X_QUATRE", "4x4", "Discovery, Defender…"],
  ["UTILITAIRE", "Utilitaire", "Kangoo, Trafic, Jumpy…"],
  ["SEPT_PLACES", "7 places", "Grand C4, Espace…"],
] as const;

export type FunnelVehicleClass = (typeof VEHICLES)[number][0];

export const VEHICLE_CLASSES: readonly string[] = VEHICLES.map(([key]) => key);
