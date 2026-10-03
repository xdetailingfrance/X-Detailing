import { prisma } from "../db";

/**
 * Journal d'audit (§30).
 *
 * Append-only : aucune fonction de mise à jour ou de suppression n'est exportée, et
 * aucune route ne l'expose. `actorLabel` est dénormalisé pour que le journal reste
 * lisible même si le compte utilisateur disparaît.
 */

export type AuditEntry = {
  actorUserId: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      actorLabel: entry.actorLabel,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: (entry.before ?? null) as never,
      after: (entry.after ?? null) as never,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
