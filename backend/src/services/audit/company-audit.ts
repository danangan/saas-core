import type { BulkInviteResult } from "../../types";
import type { CompanyDTO } from "../company/company";
import type { CompanyLimitsDTO } from "../plan/plan";
import type { UserDTO } from "../user/user";
import type { AuditActor, AuditService } from "./audit";

/**
 * Records the audit entries for changes to a company and its users: what changed between
 * before and after, as one entry per kind of change. Used by the admin routes (a platform
 * admin, any company) and the team routes (a company admin, their own company).
 */
export class CompanyAudit {
  constructor(
    private readonly audit: AuditService,
    private readonly actor: AuditActor,
  ) {}

  companyCreated(company: CompanyDTO) {
    return this.record(company.id, "company.created", company.name);
  }

  async companyUpdated(before: CompanyDTO, after: CompanyDTO) {
    if (before.name !== after.name) {
      await this.record(after.id, "company.renamed", after.name, {
        from: before.name,
        to: after.name,
      });
    }
    if (before.isActive !== after.isActive) {
      await this.record(
        after.id,
        after.isActive ? "company.activated" : "company.deactivated",
        after.name,
      );
    }
  }

  /** The plan change, and the limit overrides that changed (null = back to the plan's). */
  async limitsUpdated(company: CompanyDTO, before: CompanyLimitsDTO, after: CompanyLimitsDTO) {
    if (before.plan !== after.plan) {
      await this.record(company.id, "company.plan_changed", company.name, {
        from: before.plan,
        to: after.plan,
      });
    }
    const changed: Record<string, { from: number | null; to: number | null }> = {};
    for (const field of ["maxUsers"] as const) {
      if (before.overrides[field] !== after.overrides[field])
        changed[field] = { from: before.overrides[field], to: after.overrides[field] };
    }
    if (Object.keys(changed).length)
      await this.record(company.id, "company.limits_changed", company.name, changed);
  }

  userInvited(user: UserDTO) {
    return this.record(user.companyId, "user.invited", user.email, { role: user.role });
  }

  async usersInvited(companyId: string, results: BulkInviteResult, invited: UserDTO[]) {
    for (const user of invited) {
      const result = results.find((r) => r.email === user.email);
      await this.record(companyId, "user.invited", user.email, {
        role: user.role,
        bulk: true,
        outcome: result?.outcome,
      });
    }
  }

  invitationResent(user: UserDTO) {
    return this.record(user.companyId, "user.invitation_resent", user.email);
  }

  /** One entry per kind of change: details (name, email), role, and active. */
  async userUpdated(before: UserDTO, after: UserDTO) {
    const details: Record<string, { from: string; to: string }> = {};
    for (const field of ["firstName", "lastName", "email"] as const) {
      if (before[field] !== after[field])
        details[field] = { from: before[field], to: after[field] };
    }
    if (Object.keys(details).length)
      await this.record(after.companyId, "user.updated", after.email, details);
    if (before.role !== after.role) {
      await this.record(after.companyId, "user.role_changed", after.email, {
        from: before.role,
        to: after.role,
      });
    }
    const wasActive = before.status !== "deactivated";
    const isActive = after.status !== "deactivated";
    if (wasActive !== isActive) {
      await this.record(
        after.companyId,
        isActive ? "user.activated" : "user.deactivated",
        after.email,
      );
    }
  }

  userDeleted(user: UserDTO) {
    return this.record(user.companyId, "user.deleted", user.email);
  }

  private record(
    companyId: string,
    action: Parameters<AuditService["record"]>[0]["action"],
    targetLabel: string,
    details?: Record<string, unknown>,
  ) {
    return this.audit.record({ companyId, actor: this.actor, action, targetLabel, details });
  }
}
