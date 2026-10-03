/**
 * Identifiants des modèles de messages.
 *
 * Hors des fichiers `"use server"` : ceux-ci ne peuvent exporter que des fonctions
 * asynchrones. Les constantes partagées entre une action et la page qui l'appelle
 * vivent donc ici.
 */

/** §23 — relance d'un client sans lavage depuis la période définie. */
export const FOLLOW_UP_TEMPLATE = "relance_lavage";

/**
 * Délai avant la relance d'entretien, en jours.
 *
 * Un mois : assez tôt pour que le véhicule se soit resali, assez tard pour que le
 * message ne tombe pas comme une sollicitation de plus après la prestation.
 */
export const FOLLOW_UP_AFTER_DAYS = 30;

/** §2 — confirmation de réservation envoyée au client. */
export const BOOKING_CONFIRMATION_TEMPLATE = "confirmation_reservation";

/** §11 — « votre opérateur est en route ». */
export const EN_ROUTE_TEMPLATE = "operateur_en_route";

/** §11 — « Vous êtes presque arrivé », à l'approche du client. */
export const ARRIVING_SOON_TEMPLATE = "operateur_presque_arrive";
