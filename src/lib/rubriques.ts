// Les 18 rubriques du back-office, dans l'ordre de la navigation. « bientot »
// = module pas encore construit : la page l'indique clairement, sans
// données fictives.
import type { Permission } from "@/lib/permissions";

export type Icone =
  | "accueil" | "crm" | "meta" | "clients" | "devis" | "reservations" | "planning" | "operateurs" | "gps"
  | "interventions" | "facturation" | "comptabilite" | "depenses" | "marketing" | "automatisations" | "lola" | "rapports" | "parametres";

export type Rubrique = { href: string; libelle: string; permission: Permission; icone: Icone; groupe: string; bientot?: boolean };

export const RUBRIQUES: Rubrique[] = [
  { href: "/back-office", libelle: "Vue d'ensemble", permission: "planning", icone: "accueil", groupe: "Pilotage"},
  { href: "/back-office/crm", libelle: "Commercial et CRM", permission: "clients", icone: "crm", groupe: "Commercial", bientot: true },
  { href: "/back-office/leads", libelle: "Leads Meta Ads", permission: "clients", icone: "meta", groupe: "Commercial", bientot: true },
  { href: "/back-office/clients", libelle: "Clients", permission: "clients", icone: "clients", groupe: "Commercial" },
  { href: "/back-office/devis", libelle: "Devis", permission: "devis", icone: "devis", groupe: "Commercial" },
  { href: "/back-office/reservations", libelle: "Réservations", permission: "planning", icone: "reservations", groupe: "Opérations" },
  { href: "/back-office/planning", libelle: "Planning", permission: "planning", icone: "planning", groupe: "Opérations" },
  { href: "/back-office/operateurs", libelle: "Opérateurs", permission: "operateurs", icone: "operateurs", groupe: "Opérations" },
  { href: "/back-office/gps", libelle: "Suivi GPS", permission: "planning", icone: "gps", groupe: "Opérations", bientot: true },
  { href: "/back-office/interventions", libelle: "Interventions", permission: "planning", icone: "interventions",groupe: "Opérations" },
  { href: "/back-office/facturation", libelle: "Facturation", permission: "finances", icone: "facturation", groupe: "Argent" },
  { href: "/back-office/finances", libelle: "Comptabilité", permission: "finances", icone: "comptabilite", groupe: "Argent" },
  { href: "/back-office/depenses", libelle: "Dépenses", permission: "finances", icone: "depenses", groupe: "Argent", bientot: true },
  { href: "/back-office/marketing", libelle: "Marketing", permission: "finances", icone: "marketing", groupe: "Argent", bientot: true },
  { href: "/back-office/automatisations", libelle: "Automatisations", permission: "sms", icone: "automatisations", groupe: "Outils" },
  { href: "/back-office/lola", libelle: "Lola IA", permission: "lola", icone: "lola", groupe: "Outils" },
  { href: "/back-office/rapports", libelle: "Rapports", permission: "finances", icone: "rapports", groupe: "Outils", bientot: true },
  { href: "/back-office/parametres", libelle: "Paramètres", permission: "tarifs", icone: "parametres", groupe: "Outils" },
];

