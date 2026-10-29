// Rôles et permissions, vérifiés côté serveur (src/proxy.ts pour chaque
// page et API, puis dans les pages et routes sensibles).
import type { RoleUtilisateur } from "@/lib/types";

export type Permission =
  | "planning" // réservations, planning, affectations
  | "clients"
  | "devis"
   | "sms"
   | "lola"
   | "operateurs" // fiches et horaires des opérateurs
   | "tarifs" // prestations, prix, options
   | "finances" // CA, encaissements, dépenses
   | "audit"; // journal d'audit

const TOUTES: Permission[] = ["planning", "clients", "devis", "sms", "lola", "operateurs", "tarifs", "finances","audit"];

export const PERMISSIONS_PAR_ROLE: Record<RoleUtilisateur, Permission[]> = {
  OWNER: TOUTES,
  RESPONSABLE: ["planning", "clients", "devis", "sms", "lola", "operateurs"],
  COMMERCIAL: ["planning", "clients", "devis", "sms", "lola"],
  COMPTABLE: ["finances"],
  OPERATEUR: [],
};

export const LIBELLE_ROLE: Record<RoleUtilisateur, string> = {
  OWNER: "Directeur",
  RESPONSABLE: "Responsable",
  COMMERCIAL: "Commercial",
  OPERATEUR: "Opérateur",
  COMPTABLE: "Comptable",
};

export function aLaPermission(role: RoleUtilisateur, permission: Permission) {
  return PERMISSIONS_PAR_ROLE[role]?.includes(permission) ?? false;
}

// Permission requise par chemin (le plus long préfixe l'emporte).
const REGLES: [string, Permission][] = [
  ["/back-office/finances", "finances"],
  ["/api/finances", "finances"],
  ["/back-office/packs", "tarifs"],
  ["/api/packs", "tarifs"],
  ["/api/options", "tarifs"],
  ["/back-office/operateurs", "operateurs"],
  ["/api/operateurs", "operateurs"],
  ["/api/secteurs", "operateurs"],
  ["/back-office/planning", "planning"],
  ["/back-office/rendez-vous", "planning"],
  ["/api/rendez-vous", "planning"],
  ["/back-office/clients", "clients"],
  ["/api/clients", "clients"],
  ["/back-office/devis", "devis"],
  ["/api/devis", "devis"],
  ["/back-office/sms", "sms"],
  ["/api/sms", "sms"],
  ["/api/assistant", "lola"],
  ["/back-office/journal", "audit"],
  ["/back-office/reservations", "planning"],
  ["/back-office/interventions", "planning"],
  ["/back-office/gps", "planning"],
  ["/back-office/crm", "clients"],
  ["/back-office/leads", "clients"],
  ["/back-office/facturation", "finances"],
  ["/api/facturation", "finances"],
  ["/back-office/depenses", "finances"],
  ["/back-office/marketing", "finances"],
  ["/back-office/rapports", "finances"],
  ["/back-office/automatisations", "sms"],
  ["/back-office/lola", "lola"],
  ["/back-office/parametres", "tarifs"],
];

export function permissionRequise(chemin: string): Permission | null {
  const regle = REGLES.filter(([prefixe]) => chemin === prefixe || chemin.startsWith(`${prefixe}/`)).sort(
    (a, b) => b[0].length - a[0].length
  )[0];
  return regle ? regle[1] : null;
}

// Page d'arrivée du back-office selon le rôle.
export function accueilDuRole(role: RoleUtilisateur) {
  if (role === "OPERATEUR") return "/operateur";
  if (role === "COMPTABLE") return "/back-office/finances";
  return "/back-office";
}

