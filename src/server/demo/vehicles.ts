import type { VehicleClass } from "@/generated/prisma/enums";

/**
 * Référentiel marque / modèle (§16).
 *
 * Volontairement centré sur le parc français réellement rencontré : le but est de
 * reconnaître la voiture du client en deux frappes, pas de couvrir le marché mondial.
 * `popularity` ordonne les suggestions — les modèles les plus vendus d'abord.
 */
export const VEHICLE_MODELS: Array<{
  make: string;
  model: string;
  vehicleClass: VehicleClass;
  popularity?: number;
}> = [
  // ── Renault ──────────────────────────────────────────────────────────────
  { make: "Renault", model: "Clio", vehicleClass: "CITADINE", popularity: 100 },
  { make: "Renault", model: "Captur", vehicleClass: "SUV", popularity: 90 },
  { make: "Renault", model: "Megane", vehicleClass: "BERLINE", popularity: 85 },
  { make: "Renault", model: "Megane Estate", vehicleClass: "BREAK", popularity: 60 },
  { make: "Renault", model: "Austral", vehicleClass: "SUV", popularity: 70 },
  { make: "Renault", model: "Scenic", vehicleClass: "SEPT_PLACES", popularity: 55 },
  { make: "Renault", model: "Espace", vehicleClass: "SEPT_PLACES", popularity: 50 },
  { make: "Renault", model: "Kangoo", vehicleClass: "UTILITAIRE", popularity: 75 },
  { make: "Renault", model: "Trafic", vehicleClass: "UTILITAIRE", popularity: 65 },
  { make: "Renault", model: "Master", vehicleClass: "UTILITAIRE", popularity: 55 },
  { make: "Renault", model: "Twingo", vehicleClass: "CITADINE", popularity: 60 },
  { make: "Renault", model: "Arkana", vehicleClass: "SUV", popularity: 50 },

  // ── Peugeot ──────────────────────────────────────────────────────────────
  { make: "Peugeot", model: "208", vehicleClass: "CITADINE", popularity: 100 },
  { make: "Peugeot", model: "2008", vehicleClass: "SUV", popularity: 90 },
  { make: "Peugeot", model: "308", vehicleClass: "BERLINE", popularity: 85 },
  { make: "Peugeot", model: "308 SW", vehicleClass: "BREAK", popularity: 60 },
  { make: "Peugeot", model: "3008", vehicleClass: "SUV", popularity: 95 },
  { make: "Peugeot", model: "5008", vehicleClass: "SEPT_PLACES", popularity: 70 },
  { make: "Peugeot", model: "508", vehicleClass: "BERLINE", popularity: 55 },
  { make: "Peugeot", model: "Partner", vehicleClass: "UTILITAIRE", popularity: 65 },
  { make: "Peugeot", model: "Expert", vehicleClass: "UTILITAIRE", popularity: 55 },
  { make: "Peugeot", model: "Rifter", vehicleClass: "SEPT_PLACES", popularity: 45 },

  // ── Citroën ──────────────────────────────────────────────────────────────
  { make: "Citroën", model: "C3", vehicleClass: "CITADINE", popularity: 95 },
  { make: "Citroën", model: "C3 Aircross", vehicleClass: "SUV", popularity: 70 },
  { make: "Citroën", model: "C4", vehicleClass: "BERLINE", popularity: 70 },
  { make: "Citroën", model: "C5 Aircross", vehicleClass: "SUV", popularity: 65 },
  { make: "Citroën", model: "Grand C4 SpaceTourer", vehicleClass: "SEPT_PLACES", popularity: 50 },
  { make: "Citroën", model: "Berlingo", vehicleClass: "UTILITAIRE", popularity: 70 },
  { make: "Citroën", model: "Jumpy", vehicleClass: "UTILITAIRE", popularity: 55 },

  // ── Volkswagen ───────────────────────────────────────────────────────────
  { make: "Volkswagen", model: "Polo", vehicleClass: "CITADINE", popularity: 90 },
  { make: "Volkswagen", model: "Golf", vehicleClass: "BERLINE", popularity: 95 },
  { make: "Volkswagen", model: "Golf SW", vehicleClass: "BREAK", popularity: 55 },
  { make: "Volkswagen", model: "T-Roc", vehicleClass: "SUV", popularity: 80 },
  { make: "Volkswagen", model: "Tiguan", vehicleClass: "SUV", popularity: 85 },
  { make: "Volkswagen", model: "Passat", vehicleClass: "BERLINE", popularity: 60 },
  { make: "Volkswagen", model: "Passat SW", vehicleClass: "BREAK", popularity: 60 },
  { make: "Volkswagen", model: "Touran", vehicleClass: "SEPT_PLACES", popularity: 50 },
  { make: "Volkswagen", model: "Transporter", vehicleClass: "UTILITAIRE", popularity: 60 },
  { make: "Volkswagen", model: "Caddy", vehicleClass: "UTILITAIRE", popularity: 55 },

  // ── Dacia ────────────────────────────────────────────────────────────────
  { make: "Dacia", model: "Sandero", vehicleClass: "CITADINE", popularity: 95 },
  { make: "Dacia", model: "Duster", vehicleClass: "SUV", popularity: 90 },
  { make: "Dacia", model: "Jogger", vehicleClass: "SEPT_PLACES", popularity: 65 },
  { make: "Dacia", model: "Spring", vehicleClass: "CITADINE", popularity: 60 },

  // ── Toyota ───────────────────────────────────────────────────────────────
  { make: "Toyota", model: "Yaris", vehicleClass: "CITADINE", popularity: 90 },
  { make: "Toyota", model: "Yaris Cross", vehicleClass: "SUV", popularity: 75 },
  { make: "Toyota", model: "Corolla", vehicleClass: "BERLINE", popularity: 75 },
  { make: "Toyota", model: "Corolla Touring Sports", vehicleClass: "BREAK", popularity: 55 },
  { make: "Toyota", model: "RAV4", vehicleClass: "SUV", popularity: 70 },
  { make: "Toyota", model: "Proace", vehicleClass: "UTILITAIRE", popularity: 45 },

  // ── Premium allemandes ───────────────────────────────────────────────────
  { make: "BMW", model: "Serie 1", vehicleClass: "CITADINE", popularity: 75 },
  { make: "BMW", model: "Serie 3", vehicleClass: "BERLINE", popularity: 85 },
  { make: "BMW", model: "Serie 3 Touring", vehicleClass: "BREAK", popularity: 60 },
  { make: "BMW", model: "Serie 5", vehicleClass: "BERLINE", popularity: 60 },
  { make: "BMW", model: "X1", vehicleClass: "SUV", popularity: 75 },
  { make: "BMW", model: "X3", vehicleClass: "SUV", popularity: 70 },
  { make: "BMW", model: "X5", vehicleClass: "QUATRE_X_QUATRE", popularity: 55 },

  { make: "Audi", model: "A1", vehicleClass: "CITADINE", popularity: 70 },
  { make: "Audi", model: "A3", vehicleClass: "BERLINE", popularity: 85 },
  { make: "Audi", model: "A4", vehicleClass: "BERLINE", popularity: 75 },
  { make: "Audi", model: "A4 Avant", vehicleClass: "BREAK", popularity: 60 },
  { make: "Audi", model: "A6", vehicleClass: "BERLINE", popularity: 55 },
  { make: "Audi", model: "Q3", vehicleClass: "SUV", popularity: 75 },
  { make: "Audi", model: "Q5", vehicleClass: "SUV", popularity: 65 },
  { make: "Audi", model: "Q7", vehicleClass: "QUATRE_X_QUATRE", popularity: 45 },

  { make: "Mercedes", model: "Classe A", vehicleClass: "BERLINE", popularity: 85 },
  { make: "Mercedes", model: "Classe C", vehicleClass: "BERLINE", popularity: 75 },
  { make: "Mercedes", model: "Classe C Break", vehicleClass: "BREAK", popularity: 55 },
  { make: "Mercedes", model: "GLA", vehicleClass: "SUV", popularity: 70 },
  { make: "Mercedes", model: "GLC", vehicleClass: "SUV", popularity: 65 },
  { make: "Mercedes", model: "Vito", vehicleClass: "UTILITAIRE", popularity: 55 },
  { make: "Mercedes", model: "Sprinter", vehicleClass: "UTILITAIRE", popularity: 50 },

  // ── Autres ───────────────────────────────────────────────────────────────
  { make: "Ford", model: "Fiesta", vehicleClass: "CITADINE", popularity: 70 },
  { make: "Ford", model: "Puma", vehicleClass: "SUV", popularity: 70 },
  { make: "Ford", model: "Focus", vehicleClass: "BERLINE", popularity: 60 },
  { make: "Ford", model: "Kuga", vehicleClass: "SUV", popularity: 60 },
  { make: "Ford", model: "Transit", vehicleClass: "UTILITAIRE", popularity: 65 },

  { make: "Opel", model: "Corsa", vehicleClass: "CITADINE", popularity: 80 },
  { make: "Opel", model: "Mokka", vehicleClass: "SUV", popularity: 65 },
  { make: "Opel", model: "Astra", vehicleClass: "BERLINE", popularity: 60 },
  { make: "Opel", model: "Vivaro", vehicleClass: "UTILITAIRE", popularity: 50 },

  { make: "Fiat", model: "500", vehicleClass: "CITADINE", popularity: 80 },
  { make: "Fiat", model: "Panda", vehicleClass: "CITADINE", popularity: 65 },
  { make: "Fiat", model: "Ducato", vehicleClass: "UTILITAIRE", popularity: 55 },

  { make: "Tesla", model: "Model 3", vehicleClass: "BERLINE", popularity: 80 },
  { make: "Tesla", model: "Model Y", vehicleClass: "SUV", popularity: 85 },

  { make: "Volvo", model: "XC40", vehicleClass: "SUV", popularity: 65 },
  { make: "Volvo", model: "XC60", vehicleClass: "SUV", popularity: 60 },
  { make: "Volvo", model: "V60", vehicleClass: "BREAK", popularity: 50 },

  { make: "Land Rover", model: "Discovery", vehicleClass: "QUATRE_X_QUATRE", popularity: 45 },
  { make: "Land Rover", model: "Defender", vehicleClass: "QUATRE_X_QUATRE", popularity: 45 },
  { make: "Land Rover", model: "Range Rover Evoque", vehicleClass: "SUV", popularity: 55 },

  { make: "Nissan", model: "Qashqai", vehicleClass: "SUV", popularity: 80 },
  { make: "Nissan", model: "Juke", vehicleClass: "SUV", popularity: 65 },
  { make: "Nissan", model: "Micra", vehicleClass: "CITADINE", popularity: 55 },

  { make: "Hyundai", model: "Tucson", vehicleClass: "SUV", popularity: 70 },
  { make: "Hyundai", model: "i20", vehicleClass: "CITADINE", popularity: 60 },
  { make: "Kia", model: "Sportage", vehicleClass: "SUV", popularity: 70 },
  { make: "Kia", model: "Picanto", vehicleClass: "CITADINE", popularity: 55 },
  { make: "Seat", model: "Ibiza", vehicleClass: "CITADINE", popularity: 70 },
  { make: "Seat", model: "Arona", vehicleClass: "SUV", popularity: 60 },
  { make: "Seat", model: "Leon", vehicleClass: "BERLINE", popularity: 60 },
  { make: "Skoda", model: "Fabia", vehicleClass: "CITADINE", popularity: 65 },
  { make: "Skoda", model: "Octavia", vehicleClass: "BERLINE", popularity: 65 },
  { make: "Skoda", model: "Octavia Combi", vehicleClass: "BREAK", popularity: 55 },
  { make: "Skoda", model: "Kodiaq", vehicleClass: "SEPT_PLACES", popularity: 50 },
];
