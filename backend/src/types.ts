// The backend's types: the API's response shapes, inferred from their schemas in
// ./schemas (the UI gets the same shapes from the generated OpenAPI types). Enums come
// from the Prisma schema (@saas-core/shared/db).

import type { z } from "zod";
import type { AUDIT_ACTION_LABELS } from "@saas-core/shared";
import type {
  apiErrorSchema,
  auditEntrySchema,
  bulkInviteResultSchema,
  companyDetailSchema,
  companySummarySchema,
  companyUserSchema,
  userSchema,
  userStatusSchema,
} from "./schemas";

export type { InviteEntry } from "./schemas";

/** What an audit entry records, e.g. "user.invited" (labels in @saas-core/shared). */
export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;

export type ApiError = z.infer<typeof apiErrorSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type CompanySummary = z.infer<typeof companySummarySchema>;
export type CompanyUser = z.infer<typeof companyUserSchema>;
export type BulkInviteResult = z.infer<typeof bulkInviteResultSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type CompanyDetail = z.infer<typeof companyDetailSchema>;
export type User = z.infer<typeof userSchema>;
