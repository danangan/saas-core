// Session cookie names, shared so the UI's proxy can check for them.
export const ADMIN_SESSION_COOKIE = "saas_admin_session";
export const USER_SESSION_COOKIE = "saas_session";

// Audit log actions (audit_logs.action), and how the activity lists describe them.

export const AUDIT_ACTION_LABELS = {
  "company.created": "created the company",
  "company.renamed": "renamed the company",
  "company.activated": "activated the company",
  "company.deactivated": "deactivated the company",
  "company.plan_changed": "changed the plan of",
  "user.invited": "invited",
  "user.invitation_resent": "resent the invitation to",
  "user.updated": "updated",
  "user.role_changed": "changed the role of",
  "user.activated": "activated",
  "user.deactivated": "deactivated",
  "user.deleted": "deleted",
} as const;

/** "renamed the company", or the action itself for one this version doesn't know. */
export function auditActionLabel(action: string): string {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action;
}

// Limits the backend's request schemas enforce, and the UI's forms show.
export const PASSWORD_MIN_LENGTH = 10;
export const BULK_INVITE_MAX = 50;

// Subscription plans and the limits each gives a company. Users counted are those who can sign in or are invited (not
// deactivated).

export const PLANS = ["free", "premium"] as const;
export type PlanName = (typeof PLANS)[number];

export const PLAN_LIMITS: Record<PlanName, { maxUsers: number }> = {
  free: { maxUsers: 5 },
  premium: { maxUsers: 20 },
};

export const PLAN_LABELS: Record<PlanName, string> = { free: "Free", premium: "Premium" };
