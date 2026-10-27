// Piste d'audit des actions sensibles (table JournalAudit). Une entrée n'est
// jamais modifiée ni supprimée par l'application.
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/lib/db";
import type { SessionPayload } from "@/lib/auth";

export type Acteur = Pick<SessionPayload, "sub" | "email"> | "systeme" | "stripe" | "client" | "lola";

export async function journaliser(
  params: {
    acteur: Acteur;
    action: string;
    entite: string;
    entiteId?: string | null;
    details?: Prisma.InputJsonValue;
  },
  tx: Tx = db
) {
  const { acteur } = params;
  await tx.journalAudit.create({
    data: {
      acteurId: typeof acteur === "string" ? null : acteur.sub,
      acteur: typeof acteur === "string" ? acteur : acteur.email,
      action: params.action,
      entite: params.entite,
      entiteId: params.entiteId ?? null,
      details: params.details,
    },
  });
}

