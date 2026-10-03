import { prisma } from "@/server/db";
import { seedDataset, type SeedSummary } from "./dataset";
import type { Role } from "@/generated/prisma/enums";

/**
 * Mode démonstration.
 *
 * Une démonstration doit pouvoir être manipulée sans compte et sans crainte : on essaie
 * un parcours, on prend de vraies photos, on encaisse, et on remet tout à zéro. C'est
 * l'inverse d'un environnement de production, donc le mode est explicitement activé par
 * `DEMO_MODE=1` et refusé partout ailleurs — un déploiement réel ne doit jamais offrir
 * une session sans mot de passe ni un bouton qui efface la base.
 */

export const DEMO_ENABLED = process.env.DEMO_MODE === "1";

export type DemoPersona = {
  key: string;
  label: string;
  role: string;
  /** Ce que cette personne peut essayer, en une phrase. */
  errand: string;
  email: string | null;
  destination: string;
};

/** Les identités proposées. `email: null` désigne le visiteur non connecté. */
export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: "client",
    label: "Client",
    role: "Sans compte",
    errand: "Réserver un lavage à domicile, suivre l'opérateur, noter la prestation.",
    email: null,
    destination: "/",
  },
  {
    key: "operateur",
    label: "Opérateur",
    role: "Sur le terrain",
    errand: "Sa tournée du jour : photos avant, lavage, photos après, signature, paiement.",
    email: "mehdi@xdetailing.fr",
    destination: "/pro",
  },
  {
    key: "conseiller",
    label: "Conseiller",
    role: "Au standard",
    errand: "Prendre un appel, placer un rendez-vous, suivre la carte en direct.",
    email: "conseiller@xdetailing.fr",
    destination: "/admin",
  },
  {
    key: "direction",
    label: "Direction",
    role: "Accès complet",
    errand: "Chiffre d'affaires, équilibre entre opérateurs, reversements, impayés.",
    email: "patron@xdetailing.fr",
    destination: "/admin",
  },
];

export function findPersona(key: string): DemoPersona | null {
  return DEMO_PERSONAS.find((persona) => persona.key === key) ?? null;
}

export type DemoIdentity = {
  userId: string;
  role: Role;
  name: string;
  operatorId: string | null;
};

/** Retrouve le compte d'une persona dans le jeu de données courant. */
export async function resolveIdentity(persona: DemoPersona): Promise<DemoIdentity | null> {
  if (!persona.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: persona.email },
    include: { operator: { select: { id: true } } },
  });
  if (!user || !user.active) return null;

  return {
    userId: user.id,
    role: user.role,
    name: `${user.firstName} ${user.lastName}`,
    operatorId: user.operator?.id ?? null,
  };
}

/**
 * Deux remises à zéro simultanées se marcheraient dessus — la seconde supprimerait les
 * lignes que la première vient d'écrire. On les met donc à la queue leu leu.
 */
let pending: Promise<SeedSummary> | null = null;

export async function resetDemo(): Promise<SeedSummary> {
  if (!DEMO_ENABLED) throw new Error("Remise à zéro refusée : mode démonstration inactif.");

  pending = (pending ?? Promise.resolve(null as unknown as SeedSummary))
    .catch(() => null as unknown as SeedSummary)
    .then(() => seedDataset(prisma));

  return pending;
}
