import type { AuditAction } from "../../types";
import type { Prisma, PrismaClient } from "@saas-core/shared/db";

/** Who did something: a platform admin, or a company admin (a user). */
export type AuditActor = { type: "admin" | "user"; id: string; label: string };

export type AuditEntryDTO = {
  id: string;
  action: string;
  actorType: "admin" | "user";
  actorLabel: string;
  targetLabel: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

/**
 * The audit log: who invited, changed, deactivated or deleted whom, and when. Routes
 * record an entry after each successful change to a company or its users; the admin
 * company page and the Team page list a company's entries.
 */
export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  async record(entry: {
    companyId: string;
    actor: AuditActor;
    action: AuditAction;
    targetLabel?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.auditLog.create({
      data: {
        companyId: entry.companyId,
        actorType: entry.actor.type,
        actorId: entry.actor.id,
        actorLabel: entry.actor.label,
        action: entry.action,
        targetLabel: entry.targetLabel ?? null,
        details: (entry.details ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /** A company's most recent entries, newest first. */
  async listForCompany(companyId: string, limit = 100): Promise<AuditEntryDTO[]> {
    const rows = await this.db.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      actorType: r.actorType as "admin" | "user",
      actorLabel: r.actorLabel,
      targetLabel: r.targetLabel,
      details: r.details as Record<string, unknown>,
      createdAt: r.createdAt,
    }));
  }
}
